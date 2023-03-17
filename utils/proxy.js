import * as http from 'http'
import * as https from 'https'
import * as crypto from 'node:crypto'
import { TLSSocket } from 'tls'
import { URL } from 'url'
import { PassThrough } from 'node:stream'

const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

const defaults = {
  requestTransformer: (_request) => new PassThrough(),
  responseTransformer: (_response, _request) => new PassThrough(),
  keyAndCertGenerator: (_request) => {
    return {
      key: '-----BEGIN PRIVATE KEY-----\n' +
        'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgFy3kvv0iHTVaeqcv\n' +
        'DIzScropX09AFbieQAy8Dyh8kCihRANCAAQ+UBhyBUy/izj5jozMz+aLpzj7/lPS\n' +
        'jAQbWM+8aSDYmu7Ermo6+qz9PatGixPE1c3cq0E9BSqOEVYMXiVcizeQ\n' +
        '-----END PRIVATE KEY-----',
      cert: '-----BEGIN CERTIFICATE-----\n' +
        'MIIBlTCCATygAwIBAgIUcUDMIG9bw3nWnUS5vwGPIgX3zIcwCgYIKoZIzj0EAwIw\n' +
        'FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTIwMDEyMjIzMjIwN1oXDTIxMDEyMTIz\n' +
        'MjIwN1owFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D\n' +
        'AQcDQgAEPlAYcgVMv4s4+Y6MzM/mi6c4+/5T0owEG1jPvGkg2JruxK5qOvqs/T2r\n' +
        'RosTxNXN3KtBPQUqjhFWDF4lXIs3kKNsMGowaAYDVR0RBGEwX4IJbG9jYWxob3N0\n' +
        'ggsqLmxvY2FsaG9zdIIVbG9jYWxob3N0LmxvY2FsZG9tYWluhwR/AAABhwQAAAAA\n' +
        'hxAAAAAAAAAAAAAAAAAAAAABhxAAAAAAAAAAAAAAAAAAAAAAMAoGCCqGSM49BAMC\n' +
        'A0cAMEQCIH/3IPGNTbCQnr1F1x0r28BtwkhMZPLRSlm7p0uXDv9pAiBi4JQKEwlY\n' +
        '6sWzsJyD3vMMAyP9UZm0WJhtcOb6F0wRpg==\n' +
        '-----END CERTIFICATE-----'
    }
  }
}

const UNKNOWN_PROTOCOL = 'unknown:'

/**
 * Creates a new proxy using the provided options.
 * Returns an instance of http.Server which can be started
 * using the standard listen() method.
 *
 * @param {?object} options
 * @param {?(request:http.IncomingMessage) => stream.Duplex} options.requestTransformer - A function which receives the parsed request headers and returns a duplex stream through which the request chunks will be piped before being passed along to the receiving server. Most likely you'll want to return a custom stream.Transform instance. stream.PassThrough is used by default.
 * @param {?(response:http.IncomingMessage, request:http.IncomingMessage) => stream.Duplex} options.responseTransformer - A function which receives the parsed response and request headers and returns a duplex stream through which the response chunks will be piped before being passed along to the client. Most likely you'll want to return a custom stream.Transform instance. stream.PassThrough is used by default.
 * @param {?(request:http.IncomingMessage) => Promise<{key: string, cert: string}>|{key: string, cert: string}} keyAndCertGenerator - A function which receives the parsed request headers and returns a key and cert to be used in the TLS connection to the server, optionally wrapped in a Promise.
 * @returns {http.Server}
 */
export function createProxy (options) {
  // Filter options and backfill with defaults.
  // TODO: allow select options to be passed through to http.createServer
  const {
    requestTransformer,
    responseTransformer,
    keyAndCertGenerator
  } = { ...defaults, ...options }

  const proxy = http.createServer()

  /**
   * ABOUT "MIRROR" STREAMS
   *
   * This library creates a "mirror" stream for the client socket as well as the server socket,
   * through which the chunks they receive are piped and subsequently buffered.
   * This buffering allows Node's http parsing facilities to consume the original stream to
   * parse the headers once enough chunks have arrived (because headers can be chunked!) while allowing
   * us, once we have the parsed IncomingMessage, to consume the mirror and pass those chunks on to their destination.
   * Without this buffering, we would no longer have access to the chunks containing the headers
   * at the point that Node triggers the 'request' and 'response' events.
   *
   * For more on this buffering, see {@link https://nodejs.org/api/stream.html#buffering}
   */

  // At the first moment the client socket becomes available,
  // create a "mirror" stream.
  proxy.on('connection', (socket) => {
    // Increase max listeners as there will be a lot of concurrent requests
    // TODO: confirm that we don't have a memory leak by removing this
    // and tracing through the MaxListenersExceededWarning(s)
    socket.setMaxListeners(100)
    socket.mirror = new PassThrough()
    socket.pipe(socket.mirror)
  })

  proxy.on('connect', async (request, clientSocket, _head) => {
    // Respond to the client letting them know we've made the connection
    // {@link https://reqbin.com/Article/HttpConnect}
    // TODO:
    // - technically I believe we should be making the server connection here
    //   such that we can then pass along any DNS or handshake errors. At the moment
    //   we're not doing that until the 'request' event for simplicity but it's worth rethinking
    // - CONNECT is hop-by-hop and we should handle additional hops down the line
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

    // Get the keys and upgrade the socket to TLS
    const { key, cert } = await keyAndCertGenerator(request)
    const upgradedSocket = new TLSSocket(clientSocket, {
      rejectUnauthorized: false,
      requestCert: false,
      isServer: true,
      key,
      cert
    })

    // Emitting the 'connection' event replaces the old net.Socket with
    // our new tls.Socket and causes http.Server to attach all of the
    // necessary parser and event listeners to this new socket
    // @see {@link https://nodejs.org/api/http.html#event-connection}
    proxy.emit('connection', upgradedSocket)

    // TODO: the head param is usually empty but should be passed to the
    // server once the connection is made.
    // @see The proxy code example at {@link https://nodejs.org/api/http.html#event-connect}
  })

  proxy.on('request', (request) => {
    // Sockets are reused for subsequent requests, so previous pipes must be cleared
    // to prevent unexpected behavior. Most notably this could result in the requestTransformer
    // and responseTransformer receiving the previous request object rather than the current request.
    request.socket.mirror.unpipe()

    const urlString = request.url.startsWith('/')
      ? `${UNKNOWN_PROTOCOL}//${request.headers.host}${request.url}`
      : request.url

    const url = new URL(urlString)

    const protocol = url.protocol === UNKNOWN_PROTOCOL && request.socket instanceof TLSSocket
      ? 'https:'
      : 'http:'

    const options = {
      agent: protocol === 'https:' ? httpsAgent : httpAgent,
      port: parseInt(url.port) || (protocol === 'https:' ? 443 : 80),
      host: url.hostname,
      servername: url.hostname,
      rejectUnauthorized: false,
      // This flag allows legacy insecure renegotiation between OpenSSL and unpatched servers
      // @see {@link https://stackoverflow.com/questions/74324019/allow-legacy-renegotiation-for-nodejs}
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
    }

    const httpModule = protocol === 'https:' ? https : http

    httpModule
      .request(options)
      .on('socket', (socket) => {
        // On socket connection, forward the original client request to the server
        request.socket.mirror.pipe(requestTransformer(request)).pipe(socket)
        // Create the server socket mirror to buffer chunks
        socket.mirror = new PassThrough()
        socket.pipe(socket.mirror)
      })
      .on('response', (response) => {
        // On response, forward the original server response on to the client
        response.socket.mirror.pipe(responseTransformer(response, request)).pipe(request.socket)
        // Emit a response event on the http.Server instance to allow a similar interface as server.on('request')
        proxy.emit('response', response, request)

        // The response must be fully consumed else the response.socket listeners will
        // not get all of the chunks.
        // @see {@link https://nodejs.org/api/http.html#class-httpclientrequest}
        response.resume()
      })
    // Ensure the entire request can be consumed. This isn't documented but is here
    // on the suspicion that it functions similarly to response, as documented above.
    request.resume()
  })

  return proxy
}
