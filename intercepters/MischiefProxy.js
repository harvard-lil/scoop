import { MischiefIntercepter } from './MischiefIntercepter.js'
import { MischiefProxyExchange } from '../exchanges/index.js'
import ProxyServer from 'transparent-proxy'
import { searchBlocklistFor } from '../utils/blocklist.js'

/**
 * @class MischiefProxy
 *
 * @classdesc
 * A proxy based intercepter that captures raw HTTP exchanges
 * without parsing, preserving headers et al as delivered.
 */
export class MischiefProxy extends MischiefIntercepter {
  #connection

  exchanges = []

  /**
   * Initializes the proxy server
   */
  async setup () {
    this.#connection = new ProxyServer({
      intercept: true,
      verbose: this.options.proxyVerbose,
      injectData: this.interceptRequest,
      injectResponse: this.interceptResponse
    })

    await this.#connection.listen(this.options.proxyPort, this.options.proxyHost, () => {
      this.capture.log.info(`TCP-Proxy-Server started ${JSON.stringify(this.#connection.address())}`)
    })

    // Arbitrary 250ms wait (fix for observed start up bug)
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  /**
   * Closes the proxy server
   */
  teardown () {
    this.#connection.close()
  }

  /**
   * The proxy info to be consumed by Playwright.
   * Includes a flag to ignore certificate errors introduced by proxying.
   *
   * @property {object} proxy
   * @property {string} proxy.server The proxy url
   * @property {boolean} ignoreHTTPSErrors=true
   */
  get contextOptions () {
    return {
      proxy: { server: `http://${this.options.proxyHost}:${this.options.proxyPort}` },
      ignoreHTTPSErrors: true
    }
  }

  /**
   * Returns an exchange based on the session id and type ("request" or "response").
   * If the type is a request and there's already been a response on that same session,
   * create a new exchange. Otherwise append to continue the exchange.
   *
   * @param {string} id
   * @param {string} type
   */
  getOrInitExchange (connectionId, type) {
    // TODO: For loop-ify for clarity and maintainability?
    return (
      this.exchanges.findLast(ex => ex.connectionId === connectionId && (type === 'response' || !ex.responseRaw)) ||
        this.exchanges[this.exchanges.push(new MischiefProxyExchange({ connectionId })) - 1]
    )
  }

  /**
   * Checks an outgoing request against the blocklist. Interrupts the request it needed.
   * Keeps trace of blocked requests in `Mischief.provenanceInfo`.
   *
   * @param {object} session - ProxyServer session
   * @returns {boolean} - `true` if request was interrupted
   */
  checkRequestAgainstBlocklist (session) {
    const ip = session._dst.remoteAddress

    // https doesn't have the protocol or host in the path so add it here
    const url = (session.request.path[0] === '/')
      ? `https://${session.request.headers.host}${session.request.path}`
      : session.request.path

    // Search for a blocklist match:
    // Use the index to pull the original un-parsed rule from options so that the printing matches user expectations
    const ruleIndex = this.capture.blocklist.findIndex(searchBlocklistFor(url, ip))

    if (ruleIndex === -1) {
      return false
    }

    const rule = this.capture.options.blocklist[ruleIndex]
    this.capture.log.warn(`Blocking ${url} resolved to IP ${ip} matching rule ${rule}`)
    this.capture.provenanceInfo.blockedRequests.push({ url, ip, rule })

    // TODO: confirm in transparent-proxy that this doesn't kill subsequent
    // requests that were earmarked for this session
    session.destroy()

    return true
  }

  interceptRequest = (data, session) => {
    this.checkRequestAgainstBlocklist(session) // May interrupt request

    if (!session._src.destroyed && !session._dst.destroyed) {
      return this.intercept('request', data, session)
    }
  }

  interceptResponse = (data, session) => {
    return this.intercept('response', data, session)
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Post-capture checks and capture size enforcement happens here.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {Session} session
   */
  intercept (type, data, session) {
    // Early exit with unmodified data if not recording exchanges
    if (!this.recordExchanges) {
      return data
    }

    const ex = this.getOrInitExchange(session._id, type)
    const prop = `${type}Raw` // `responseRaw` | `requestRaw`
    ex[prop] = ex[prop] ? Buffer.concat([ex[prop], data], ex[prop].length + data.length) : data

    if (type === 'response') {
      this.checkExchangeForNoArchive(ex)
    }

    this.byteLength += data.byteLength
    this.checkAndEnforceSizeLimit() // From parent
    return data
  }
}
