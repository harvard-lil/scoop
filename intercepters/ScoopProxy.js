import * as crypto from 'node:crypto'
import { Transform } from 'node:stream'
import { createServer } from '@harvard-lil/portal'

import { ScoopIntercepter } from './ScoopIntercepter.js'
import { ScoopProxyExchange } from '../exchanges/index.js'
import { searchBlocklistFor } from '../utils/blocklist.js'

import http from 'http' // eslint-disable-line
import net from 'net' // eslint-disable-line

/**
 * @class ScoopProxy
 * @extends ScoopIntercepter
 *
 * @classdesc
 * A proxy-based intercepter that captures raw HTTP exchanges without parsing, preserving headers et al as delivered.
 * Coalesces exchanges as ScoopProxyExchange entries.
 */
export class ScoopProxy extends ScoopIntercepter {
  /** @type {http.Server} */
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
   * @param {http.ClientRequest} request
   * @returns {Transform}
   */
  requestTransformer (request) {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        callback(null, this.intercept('request', chunk, request))
      }
    })
  }

  /**
   * @param {http.ServerResponse} _response
   * @param {http.ClientRequest} request
   * @returns {Transform}
   */
  responseTransformer (_response, request) {
    return new Transform({
      transform: (chunk, _encoding, callback) => {
        callback(null, this.intercept('response', chunk, request))
      }
    })
  }

  /**
   * Attempts to close the proxy server. Skips after X seconds if unable to do so.
   * @returns {Promise<void>}
   */
  teardown () {
    let closeTimeout = null

    return Promise.race([
      new Promise(resolve => {
        // server.close does not close keep-alive connections so do so here
        this.#connection.closeAllConnections()
        this.#connection.close(() => {
          this.capture.log.info('TCP-Proxy-Server closed')
          clearTimeout(closeTimeout)
          resolve()
        })
      }),

      new Promise(resolve => {
        closeTimeout = setTimeout(() => {
          this.capture.log.warn('TCP-Proxy-Server did not close properly.')
          resolve()
        }, 5000)
      })
    ])
  }

  /**
   * On request:
   * - Add to exchanges list (if currently recording exchanges)
   * - Check request against blocklist, block if necessary
   *
   * @param {http.ClientRequest} request
   */
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

  /**
   * On connected:
   * - Check against blocklist, block if necessary
   *
   * @param {net.Socket} serverSocket
   * @param {http.ClientRequest} request
   */
  onConnected (serverSocket, request) {
    const ip = serverSocket.remoteAddress
    const rule = this.findMatchingBlocklistRule(ip)
    if (rule) {
      serverSocket.destroy()
      this.blockRequest(request, ip, rule)
    }
  }

  /**
   * On response:
   * - Parse response
   * @param {http.ServerResponse} response
   * @param {http.ClientRequest} request
   */
  onResponse (response, request) {
    // there will not be an exchange with this request if we're, for instance, not recording
    const exchange = this.exchanges.find(ex => ex.requestParsed === request)

    if (exchange) {
      exchange.responseParsed = response
    }
  }

  /**
   * Custom error handling.
   * Currently handled: ETIMEDOUT, ENOTFOUND, EPIPE.
   * @param {object} err
   * @param {http.ServerResponse} _serverRequest
   * @param {http.ClientRequest} clientRequest
   * @returns {void}
   */
  onError (err, _serverRequest, clientRequest) {
    // Quietly suppress socket disconnection errors
    // when we have no way to send notice back to the client
    if (!clientRequest) return

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
   * "Blocks" a request by writing HTTP 403 to request socket.
   * @param {http.ClientRequest} request
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
