import { MischiefIntercepter } from './MischiefIntercepter.js'
import { MischiefProxyExchange } from '../exchanges/index.js'
import ProxyServer from 'transparent-proxy'
import { searchBlacklistFor } from '../utils/blacklist.js'

export class MischiefProxy extends MischiefIntercepter {
  #connection

  exchanges = []

  async setup () {
    this.#connection = new ProxyServer({
      intercept: true,
      verbose: this.options.proxyVerbose,
      injectData: this.interceptRequest.bind(this),
      injectResponse: this.interceptResponse.bind(this)
    })

    await this.#connection.listen(this.options.proxyPort, this.options.proxyHost, () => {
      this.capture.log.info(`TCP-Proxy-Server started ${JSON.stringify(this.#connection.address())}`)
    })

    // Arbitrary 250ms wait (fix for observed start up bug)
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  teardown () {
    this.#connection.close()
  }

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

  interceptRequest (data, session) {
    const url = (session.request.path[0] === '/')
      ? `https:${session.request.headers.host}${session.request.path}`
      : session.request.path
    const ip = session._dst.remoteAddress

    const ruleIndex = this.capture.blacklist.findIndex(searchBlacklistFor(url, ip))
    if (ruleIndex > -1) {
      const rule = this.capture.options.blacklist[ruleIndex]
      this.capture.log.warn(`Blocking ${url} resolved to IP ${ip} matching rule ${rule}`)
      this.capture.provenanceInfo.blockedRequests.push({ url, ip, rule })
      return session.destroy()
    }

    return this.intercept('request', data, session)
  }

  interceptResponse (data, session) {
    return this.intercept('response', data, session)
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Capture size enforcement happens here.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {Session} session
   */
  intercept (type, data, session) {
    if (!this.record) {
      return data
    }

    const ex = this.getOrInitExchange(session._id, type)
    const prop = `${type}Raw` // `responseRaw` | `requestRaw`
    ex[prop] = ex[prop] ? Buffer.concat([ex[prop], data], ex[prop].length + data.length) : data

    this.byteLength += data.byteLength
    this.checkAndEnforceSizeLimit() // From parent
    return data
  }
}
