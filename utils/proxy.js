import * as http from 'http'
import * as https from 'https'
import * as crypto from 'node:crypto'
import { TLSSocket } from 'tls'
import { URL } from 'url'
import { PassThrough } from 'node:stream'

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

export function createProxy (options) {
  const {
    requestTransformer,
    responseTransformer,
    keyAndCertGenerator
  } = { ...defaults, ...options }

  const proxy = http.createServer()

  proxy.on('connection', (socket) => {
    socket.setMaxListeners(100) // there will be a lot of concurrent requests
    socket.mirror = new PassThrough()
    socket.pipe(socket.mirror)
  })

  proxy.on('connect', async (request, clientSocket, _head) => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    // upgrade socket and event listeners everything
    const { key, cert } = await keyAndCertGenerator(request)
    const upgradedSocket = new TLSSocket(clientSocket, {
      rejectUnauthorized: false,
      requestCert: false,
      isServer: true,
      key,
      cert
    })
    proxy.emit('connection', upgradedSocket)
    // TODO: assign clientSocket.connectHead = head and then write to the server socket once established later on
  })

  proxy.on('request', (request) => {
    // clear existing pipes from previous requests
    // otherwise the previous request will be sent to the transformer
    request.socket.mirror.unpipe()

    const urlString = request.url.startsWith('/')
      ? `${UNKNOWN_PROTOCOL}//${request.headers.host}${request.url}`
      : request.url

    const url = new URL(urlString)

    const protocol = url.protocol === UNKNOWN_PROTOCOL && request.socket instanceof TLSSocket
      ? 'https:'
      : 'http:'

    const options = {
      port: parseInt(url.port) || (protocol === 'https:' ? 443 : 80),
      host: url.hostname,
      servername: url.hostname,
      rejectUnauthorized: false,
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
    }

    const httpModule = protocol === 'https:' ? https : http

    httpModule
      .request(options)
      .on('socket', (socket) => {
        request.socket.mirror.pipe(requestTransformer(request)).pipe(socket)
        socket.mirror = new PassThrough()
        socket.pipe(socket.mirror)
      })
      .on('response', (response) => {
        response.socket.mirror.pipe(responseTransformer(response, request)).pipe(request.socket)
        proxy.emit('response', response, request)

        // The response must be fully consumed else the response.socket listeners will
        // not get all of the chunks. {@link https://nodejs.org/api/http.html#class-httpclientrequest}
        response.resume()
      })
    // ensure the entire request can be consumed. This isn't documented but is here
    // on the suspicion that it functions similarly to response
    request.resume()
  })

  return proxy
}
