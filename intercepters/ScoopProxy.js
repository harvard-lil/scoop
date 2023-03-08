import * as http from 'http'
import * as net from 'net'
import * as tls from 'tls'
import { PassThrough } from 'node:stream'
import { URL } from 'url'

import { ScoopIntercepter } from './ScoopIntercepter.js'
import { ScoopProxyExchange } from '../exchanges/index.js'
import { searchBlocklistFor } from '../utils/blocklist.js'

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
    this.#connection = http.createServer()
                           .on('connection', this.onConnection)
                           .on('connect', (request, clientSocket, head) => this.onConnect(request, clientSocket, head))
                           .on('request', (request) => this.onRequest(request))

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

  attachRequestParser (socket, callback) {
    const mirror = new net.Socket()
    socket.prependListener('data', data => { mirror.emit('data', data) })

    http.createServer()
      .on('request', callback)
      .emit('connection', mirror)
  }

  attachResponseParser (socket, callback) {
    const mirror = new net.Socket()
    socket.prependListener('data', data => { mirror.emit('data', data) })

    http.request({ createConnection: () => mirror })
      .on('response', callback)
  }

  cacheBody (message) {
    message.on('data', (data) => {
      message.body = message.body
        ? Buffer.concat([message.body, data], message.body.length + data.length)
        : data
    })
  }

  onConnection (socket) {
    socket.mirror = new PassThrough()
    socket.mirror.cork()
    socket.pipe(socket.mirror)
    // socket.on('data', (data) => { debugger })
    // const kOnMessageBegin = socket.parser.constructor.kOnMessageBegin | 0
    // socket.parser[kOnMessageBegin] = () => {
    //   debugger
    //   const connectionId = `${socket.remoteAddress}:${socket.remotePort}`
    //   // this.exchanges.push(new ScoopProxyExchange({ connectionId }))
    // }
  }

  onConnect (request, clientSocket, head) {
    console.log('onConnect')
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
  }

  onRequest (request) {
    this.cacheBody(request)

    const exchange = new ScoopProxyExchange({ request })
    this.exchanges.push(exchange)

    const url = new URL(request.url)

    const options = {
      port: parseInt(url.port) || 80,
      host: url.hostname,
      servername: url.hostname
    }

    const transport = options.port === 443 ? tls : net

    const serverSocket = transport.connect(options, () => {
      const clientSocket = request.socket
      const clientMirror = request.socket.mirror

      this.attachResponseParser(serverSocket, (response) => {
        this.cacheBody(response)
        exchange.response = response
      })

      clientMirror.on('data', data => this.intercept('request', data, exchange))
      serverSocket.on('data', data => this.intercept('response', data, exchange))

      serverSocket.pipe(clientSocket)
      clientMirror.pipe(serverSocket)

      process.nextTick(() => clientMirror.uncork())
    })
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
  matchFoundInBlocklist (exchange) {
    const ip = exchange.response?.socket?.remoteAddress

    // Search for a blocklist match:
    // Use the index to pull the original un-parsed rule from options so that the printing matches user expectations
    const ruleIndex = this.capture.blocklist.findIndex(searchBlocklistFor(exchange.url, ip))

    if (ruleIndex === -1) {
      return false
    }

    const rule = this.capture.options.blocklist[ruleIndex]
    this.capture.log.warn(`Blocking ${exchange.url} resolved to IP ${ip} matching rule ${rule}`)
    this.capture.provenanceInfo.blockedRequests.push({ url: exchange.url, ip, rule })

    exchange.request.socket.destroy()

    return true
  }

  /**
   * Collates network data (both requests and responses) from the proxy.
   * Post-capture checks and capture size enforcement happens here.
   *
   * @param {string} type
   * @param {Buffer} data
   * @param {ScoopProxyExchange} exchange
   * @returns {Buffer}
   */
  intercept (type, data, exchange) {
    // Early exit if not recording exchanges or request is blocked
    if (!this.recordExchanges ||
        (type === 'response' && this.matchFoundInBlocklist(exchange))) {
      return
    }

    const prop = `${type}Raw` // `responseRaw` | `requestRaw`
    exchange[prop] = Buffer.concat([exchange[prop], data], exchange[prop].length + data.length)

    // NOTE: Temporarily moved as a capture step until this proxy is replaced.
    // The main issue was that we could not easily identify "when" to run this step, resulting in multiple, unnecessary calls.
    /*
    if (type === 'response') {
      this.checkExchangeForNoArchive(exchange)
    }
    */

    this.byteLength += data.byteLength
    this.checkAndEnforceSizeLimit() // From parent
  }
}
