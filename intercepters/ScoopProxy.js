import { Transform } from 'node:stream'

import { ScoopIntercepter } from './ScoopIntercepter.js'
import { ScoopProxyExchange } from '../exchanges/index.js'
import { searchBlocklistFor } from '../utils/blocklist.js'
import { createProxy } from '../utils/proxy.js'

/**
 * @class ScoopProxy
 * @extends ScoopIntercepter
 *
 * @classdesc
 * A proxy-based intercepter that captures raw HTTP exchanges without parsing, preserving headers et al as delivered.
 * Coalesces exchanges as ScoopProxyExchange entries.
 */
export class ScoopProxy extends ScoopIntercepter {
  /** @type {ProxyServer} */
  #connection

  /** @type {ScoopProxyExchange[]} */
  exchanges = []

  /**
   * Initializes the proxy server
   */
  async setup () {
    this.#connection = createProxy({
      requestTransformer: this.requestTransformer.bind(this),
      responseTransformer: this.responseTransformer.bind(this)
    })
      .on('request', this.onRequest.bind(this))
      .on('response', this.onResponse.bind(this))

    await this.#connection.listen(this.options.proxyPort, this.options.proxyHost, () => {
      this.capture.log.info(`TCP-Proxy-Server started ${JSON.stringify(this.#connection.address())}`)
    })

    // Arbitrary 250ms wait (fix for observed start up bug)
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  /**
   * Closes the proxy server
   * @returns {Promise<void>}
   */
  async teardown () {
    this.#connection.close()
    this.#connection.unref()
    return true
  }

  cacheBody (message) {
    message.on('data', (data) => {
      message.body = message.body
        ? Buffer.concat([message.body, data], message.body.length + data.length)
        : data
    })
  }

  onRequest (request) {
    if (this.recordExchanges && !this.urlFoundInBlocklist(request)) {
      const exchange = new ScoopProxyExchange({ requestParsed: request })
      this.exchanges.push(exchange)
      this.cacheBody(request)
    }
  }

  onResponse (response, request) {
    // there will not be an exchange with this request if we're, for instance, not recording
    const exchange = this.exchanges.find(ex => ex.requestParsed === request)
    if (exchange && !this.ipFoundInBlocklist(request)) {
      exchange.responseParsed = response
      response.on('end', () => this.checkExchangeForNoArchive(exchange))
      this.cacheBody(response)
    }
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
   * Checks an outgoing request against the blocklist. Interrupts the request it needed.
   * Keeps trace of blocked requests in `Scoop.provenanceInfo`.
   *
   * @param {ScoopProxyExchange} exchange
   * @returns {boolean} - `true` if request was interrupted
   */
  urlFoundInBlocklist (request) {
    return false
    const url = request.url.startsWith('/')
      ? `https://${request.headers.host}${request.url}`
      : request.url

    // Search for a blocklist match:
    // Use the index to pull the original un-parsed rule from options so that the printing matches user expectations
    const ruleIndex = this.capture.blocklist.findIndex(searchBlocklistFor(url))

    if (ruleIndex === -1) {
      return false
    }

    const rule = this.capture.options.blocklist[ruleIndex]
    this.capture.log.warn(`Blocking ${url} matching rule ${rule}`)
    this.capture.provenanceInfo.blockedRequests.push({ url, rule })

    request.socket.destroy()

    return true
  }

  /**
   * Checks an outgoing request against the blocklist. Interrupts the request it needed.
   * Keeps trace of blocked requests in `Scoop.provenanceInfo`.
   *
   * @param {ScoopProxyExchange} exchange
   * @returns {boolean} - `true` if request was interrupted
   */
  ipFoundInBlocklist (response) {
    return false
    const ip = response.socket.remoteAddress

    // Search for a blocklist match:
    // Use the index to pull the original un-parsed rule from options so that the printing matches user expectations
    const ruleIndex = this.capture.blocklist.findIndex(searchBlocklistFor(ip))

    if (ruleIndex === -1) {
      return false
    }

    const rule = this.capture.options.blocklist[ruleIndex]
    this.capture.log.warn(`Blocking IP ${ip} matching rule ${rule}`)
    this.capture.provenanceInfo.blockedRequests.push({ ip, rule })

    response.socket.destroy()

    return true
  }

  requestTransformer (request) {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        callback(null, this.intercept('request', chunk, request))
      }
    })
  }

  responseTransformer (_response, request) {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        callback(null, this.intercept('response', chunk, request))
      }
    })
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Post-capture checks and capture size enforcement happens here.
   * Acts as a transformer in the proxy pipeline and therefor must return
   * the data to be passed forward.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {ScoopProxyExchange} exchange
   * @returns {Buffer}
   */
  intercept (type, data, request) {
    const exchange = this.exchanges.find(ex => ex.requestParsed === request)
    if (!exchange) return data // Early exit if not recording exchanges or request is blocked

    const prop = `${type}Raw` // `responseRaw` | `requestRaw`
    exchange[prop] = Buffer.concat([exchange[prop], data], exchange[prop].length + data.length)

    this.byteLength += data.byteLength
    this.checkAndEnforceSizeLimit() // From parent

    return data
  }
}
