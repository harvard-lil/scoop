import * as http from 'http'
import * as https from 'https'
import { TLSSocket } from 'tls'
import { URL } from 'url'
import { PassThrough } from 'node:stream'

const clientDefaults = {
  rejectUnauthorized: false,
  requestCert: false,
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

const defaults = {
  requestTransformer: (_request) => new PassThrough(),
  responseTransformer: (_response, _request) => new PassThrough(),
  clientOptions: (_request) => { return {} },
  serverOptions: (_request) => { return {} }
}

function assignMirror (socket) {
  if (!socket.mirror) {
    // Increase max listeners, primarily for the client socket, as there will be a lot of concurrent requests
    // TODO: confirm that we don't have a memory leak by removing this and tracing through MaxListenersExceededWarning(s)
    socket.setMaxListeners(100)
    socket.mirror = new PassThrough()
    socket.pipe(socket.mirror)
  }
}

/**
 * Use http agents to keep sockets alive for greater efficiency
 */
const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })
const CONNECT = 'CONNECT'
const UNKNOWN_PROTOCOL = 'unknown:'

function getServerDefaults (request) {
  const url = new URL(
    request.method === CONNECT || request.url.startsWith('/')
      ? `${UNKNOWN_PROTOCOL}//${request.headers.host || request.url}`
      : request.url
  )
  const protocol = url.protocol === UNKNOWN_PROTOCOL && (request.method === CONNECT || request.socket instanceof TLSSocket)
    ? 'https:'
    : 'http:'
  return {
    host: url.hostname,
    servername: url.hostname,
    port: parseInt(url.port) || (protocol === 'https:' ? 443 : 80),
    agent: protocol === 'https:' ? httpsAgent : httpAgent
  }
}

const CRLFx2 = '\r\n\r\n'

function getHandler (proxy, clientOptions, serverOptions, requestTransformer, responseTransformer) {
  return async (request, _, head) => {
    const { socket: clientSocket } = request

    // Sockets are reused for subsequent requests, so previous pipes must be cleared.
    // Failure to do so will cause the wrong request object to be passed to the transformers
    clientSocket.mirror.unpipe()

    const customOptions = await serverOptions(request)
    const options = { ...getServerDefaults(request), ...customOptions }

    const httpModule = options.agent === httpsAgent ? https : http

    httpModule
      .request(options)
      .on('socket', async serverSocket => {
        assignMirror(serverSocket)
        proxy.on('close', () => serverSocket.destroy())

        serverSocket.on('connect', async () => {
          proxy.emit('connected', serverSocket, request)
          if (serverSocket.destroyed) return // serverSocket may be destroyed via a 'connected' event listener

          if (request.method === CONNECT) {
            // Replace old net.Socket with new tls.Socket and attach parser and event listeners
            // @see {@link https://nodejs.org/api/http.html#event-connection}
            const options = await clientOptions(request)
            proxy.emit('connection', new TLSSocket(clientSocket, { ...clientDefaults, ...options, isServer: true }))

            // Letting client know we've made the connection @see {@link https://reqbin.com/Article/HttpConnect}
            // TODO: CONNECT is hop-by-hop and we should handle additional hops down the line
            clientSocket.write('HTTP/1.1 200 Connection Established' + CRLFx2)
            serverSocket.write(head)
          } else {
            clientSocket.mirror.pipe(requestTransformer(request)).pipe(serverSocket)
          }
        })
      })
      .on('response', (response) => {
        // On response, forward the original server response on to the client
        response.socket.mirror.pipe(responseTransformer(response, request)).pipe(request.socket)

        // Emit a response event on the http.Server instance to allow a similar interface as server.on('request')
        proxy.emit('response', response, request)

        // response must be fully consumed else response.socket listeners won't get all of the chunks.
        // @see {@link https://nodejs.org/api/http.html#class-httpclientrequest}
        response.resume()
      })
      .on('error', (err) => {
        switch (err.code) {
          case 'ETIMEDOUT':
            clientSocket.write('HTTP/1.1 408 Request Timeout' + CRLFx2)
            break
          default:
            clientSocket.write('HTTP/1.1 502 Bad Gateway' + CRLFx2)
        }
      })
    // Ensure the entire request can be consumed. This isn't documented but is here
    // on the suspicion that it functions similarly to response, as documented above.
    request.resume()
  }
}

/**
 * Creates a new proxy using the provided options.
 * Returns an instance of http.Server which can be started
 * using the standard listen() method.
 *
 * @param {?object} options
 * @param {?(request:http.IncomingMessage) => stream.Duplex} options.requestTransformer - A function which receives the parsed request headers and returns a duplex stream through which the request chunks will be piped before being passed along to the receiving server. Most likely you'll want to return a custom stream.Transform instance. stream.PassThrough is used by default.
 * @param {?(response:http.IncomingMessage, request:http.IncomingMessage) => stream.Duplex} options.responseTransformer - A function which receives the parsed response and request headers and returns a duplex stream through which the response chunks will be piped before being passed along to the client. Most likely you'll want to return a custom stream.Transform instance. stream.PassThrough is used by default.
 * @param {?(request:http.IncomingMessage) => Promise<object>|object} clientOptions - A function which receives the parsed request headers and returns options to be fed into the creation of a new client tls.TLSSocket. Primarily useful to generate a key and cert. Optionally can return a Promise. @see {@link https://nodejs.org/api/tls.html#class-tlstlssocket}
  * @param {?(request:http.IncomingMessage) => Promise<object>|object} serverOptions - A function which receives the parsed request headers and returns options to be fed into the request to the destination server. Primarily useful for setting SSL flags. Optionally can return a Promise. @see {@link https://nodejs.org/api/https.html#httpsrequestoptions-callback}
 * @returns {http.Server}
 */
export function createServer (options) {
  // Filter options and backfill with defaults.
  const {
    requestTransformer,
    responseTransformer,
    clientOptions,
    serverOptions,
    ...passalongOptions
  } = { ...defaults, ...options }

  const proxy = http.createServer(passalongOptions)
  const handler = getHandler(proxy, clientOptions, serverOptions, requestTransformer, responseTransformer)

  proxy
    .on('connection', assignMirror)
    .on('request', handler)
    .on('connect', handler)

  return proxy
}
