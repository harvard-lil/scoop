import * as http from 'http'
import { URL } from 'url'
import { Transform, PassThrough } from 'node:stream'

const defaults = {
  requestTransformer: (_request) => new PassThrough(),
  responseTransformer: (_response, _request) => new PassThrough()
}

export function createProxy (options) {
  const { requestTransformer, responseTransformer } = { ...defaults, ...options }
  const proxy = http.createServer()

  proxy.on('connection', (socket) => {
    socket.mirror = new Transform({
      transform: (chunk, _encoding, callback) => {
        process.nextTick(callback, null, chunk)
      }
    })
    socket.pipe(socket.mirror)
  })

  proxy.on('request', (request) => {
    const url = new URL(request.url)

    const options = {
      port: url.port || 80,
      host: url.hostname,
      servername: url.hostname
    }

    http
      .request(options)
      .on('socket', (socket) => {
        request.socket.mirror.pipe(requestTransformer(request)).pipe(socket)
        socket.mirror = new PassThrough()
        socket.pipe(socket.mirror)
      })
      .on('response', (response) => {
        response.socket.mirror.pipe(responseTransformer(response, request)).pipe(request.socket)
        proxy.emit('response', response, request)
      })
  })

  return proxy
}
