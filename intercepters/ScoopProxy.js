import * as crypto from 'node:crypto'
import { Transform } from 'node:stream'

import { ScoopIntercepter } from './ScoopIntercepter.js'
import { ScoopProxyExchange } from '../exchanges/index.js'
import { searchBlocklistFor } from '../utils/blocklist.js'
import { createServer } from '../utils/portal/Portal.js'

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
  setup () {
    return new Promise(resolve => {
      this.#connection = createServer({
        requestTransformer: this.requestTransformer.bind(this),
        responseTransformer: this.responseTransformer.bind(this),
        serverOptions: () => {
          return {
            rejectUnauthorized: false,
            // This flag allows legacy insecure renegotiation between OpenSSL and unpatched servers
            // @see {@link https://stackoverflow.com/questions/74324019/allow-legacy-renegotiation-for-nodejs}
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
          }
        }
      })

      this.#connection
        .on('request', this.onRequest.bind(this))
        .on('connected', this.onConnected.bind(this))
        .on('response', this.onResponse.bind(this))
        .on('error', this.onError.bind(this))
        .listen(this.options.proxyPort, this.options.proxyHost, () => {
          this.capture.log.info(`TCP-Proxy-Server started ${JSON.stringify(this.#connection.address())}`)
          resolve()
        })
    })
  }

  /**
   * Closes the proxy server
   * @returns {Promise<void>}
   */
  teardown () {
    // server.close does not close keep-alive connections so do so here
    return new Promise(resolve => {
      this.#connection.closeAllConnections()
      this.#connection.close(() => {
        this.capture.log.info('TCP-Proxy-Server closed')
        resolve()
      })
    })
  }

  onRequest (request) {
    if (this.recordExchanges) {
      this.exchanges.push(new ScoopProxyExchange({ requestParsed: request }))
    }

    const url = request.url.startsWith('/')
      ? `https://${request.headers.host}${request.url}`
      : request.url
    const rule = this.findMatchingBlocklistRule(url)
    if (rule) {
      this.blockRequest(request, url, rule)
    }
  }

  onConnected (serverSocket, request) {
    const ip = serverSocket.remoteAddress
    const rule = this.findMatchingBlocklistRule(ip)
    if (rule) {
      serverSocket.destroy()
      this.blockRequest(request, ip, rule)
    }
  }

  onResponse (response, request) {
    // there will not be an exchange with this request if we're, for instance, not recording
    const exchange = this.exchanges.find(ex => ex.requestParsed === request)
    if (exchange) {
      exchange.responseParsed = response
      response.on('end', () => this.checkExchangeForNoArchive(exchange))
    }
  }

  onError (err, serverRequest, clientRequest) {
    // errors on the client side will only have an err param, no serverRequest or clientRequest
    // If we get one of those, throw it as though we don't have a listener on('error')
    if (!clientRequest) throw err

    const CRLFx2 = '\r\n\r\n'
    switch (err.code) {
      case 'ETIMEDOUT':
        clientRequest.socket.write('HTTP/1.1 408 Request Timeout' + CRLFx2)
        break
      case 'ENOTFOUND':
        clientRequest.socket.write('HTTP/1.1 404 Not Found' + CRLFx2)
        break
      case 'EPIPE':
        break
      default:
        clientRequest.socket.write('HTTP/1.1 400 Bad Request' + CRLFx2)
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
   * @param {string} toMatch
   * @returns {boolean} - `true` if a match was found in the blocklist
   */
  findMatchingBlocklistRule (toMatch) {
    // Search for a blocklist match:
    // Use the index to pull the original un-parsed rule from options so that the printing matches user expectations
    return this.capture.options.blocklist[
      this.capture.blocklist.findIndex(searchBlocklistFor(toMatch))
    ]
  }

  /**
   * @param {IncomingMessage} request
   * @param {string} match
   * @param {object} rule
   */
  blockRequest (request, match, rule) {
    request.socket.write(
      'HTTP/1.1 403 Forbidden\r\n\r\n' +
      `During capture, request for ${match} matched blocklist rule ${rule} and was blocked.`
    )
    this.capture.log.warn(`Blocking ${match} matching rule ${rule}`)
    this.capture.provenanceInfo.blockedRequests.push({ match, rule })
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
    if (!exchange) return data // Early exit if not recording exchanges

    const prop = `${type}Raw` // `responseRaw` | `requestRaw`
    exchange[prop] = Buffer.concat([exchange[prop], data])

    this.byteLength += data.byteLength
    this.checkAndEnforceSizeLimit() // From parent

    return data
  }
}
