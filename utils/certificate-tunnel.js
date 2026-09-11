import { once } from 'node:events'
import { createServer, request as httpRequest } from 'node:http'
import { isIP, connect } from 'node:net'

const LOOPBACK_HOST = '127.0.0.1'

function connectTarget (authority) {
  if (typeof authority !== 'string' || authority.length === 0 || /[\s/@?#\\]/.test(authority)) {
    throw new TypeError('CONNECT requires a host and port')
  }

  const portText = authority.slice(authority.lastIndexOf(':') + 1)
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('CONNECT requires a port from 1 through 65535')
  }

  const url = new URL(`https://${authority}`)
  if (!url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('CONNECT requires an HTTPS authority')
  }

  return { url: url.href, port }
}

function rejectConnect (socket, status) {
  if (!socket.destroyed) {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`)
  }
}

function verifiedAddress (destination) {
  if (!destination || typeof destination.address !== 'string') {
    throw new TypeError('NetworkPolicy.resolve() must return an address')
  }

  const family = isIP(destination.address)
  if (family === 0 || (destination.family !== undefined && destination.family !== family)) {
    throw new TypeError('NetworkPolicy.resolve() returned an invalid address')
  }

  return family
}

/**
 * Starts a loopback-only HTTP CONNECT tunnel for one certificate-ripper run.
 * The supplied NetworkPolicy approves and resolves each requested target before
 * the tunnel opens a TCP socket, then verifies the connected peer before data
 * can flow. TLS stays end-to-end between certificate-ripper and the target.
 *
 * @param {{assertUrl: (input: string) => void, resolve: (input: string, options?: {signal?: AbortSignal}) => Promise<{url: URL, hostname: string, address: string, family: number, lookup?: Function}>, verifyPeer: (socket: import('node:net').Socket, destination: object) => void | Promise<void>}} networkPolicy
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<{host: string, port: number, close: () => Promise<void>}>}
 */
export async function createCertificateTunnel (networkPolicy, { signal } = {}) {
  if (!networkPolicy || typeof networkPolicy.assertUrl !== 'function' || typeof networkPolicy.resolve !== 'function' || typeof networkPolicy.verifyPeer !== 'function') {
    throw new TypeError('A NetworkPolicy with assertUrl(), resolve(), and verifyPeer() is required')
  }
  if (signal?.aborted) {
    throw signal.reason ?? new Error('Certificate tunnel was aborted')
  }

  const controller = new AbortController()
  const sockets = new Set()
  const server = createServer(async (request, response) => {
    await handleHttpRequest(request, response, networkPolicy, controller.signal, sockets)
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })

  server.on('connect', async (request, client, head) => {
    await handleConnect(request, client, head, networkPolicy, controller.signal, sockets)
  })

  let closePromise
  const close = (reason = new Error('Certificate tunnel closed')) => {
    if (closePromise) return closePromise
    controller.abort(reason)
    for (const socket of sockets) socket.destroy()
    closePromise = new Promise((resolve) => {
      const stop = () => {
        if (server.listening) server.close(resolve)
        else resolve()
      }
      if (server.listening) stop()
      else {
        server.once('listening', stop)
        server.once('error', resolve)
      }
    })
    return closePromise
  }
  const abort = () => close(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  server.once('close', () => signal?.removeEventListener('abort', abort))

  server.listen({ host: LOOPBACK_HOST, port: 0 })
  try {
    await once(server, 'listening')
  } catch (error) {
    await close()
    throw error
  }
  if (controller.signal.aborted) {
    await close()
    throw controller.signal.reason
  }

  const address = server.address()
  if (!address || typeof address === 'string') {
    await close()
    throw new Error('Certificate tunnel did not receive a loopback port')
  }

  return { host: LOOPBACK_HOST, port: address.port, close }
}

async function handleConnect (request, client, head, networkPolicy, signal, sockets) {
  let upstream
  try {
    const target = connectTarget(request.url)
    await networkPolicy.assertUrl(target.url)
    const destination = await networkPolicy.resolve(target.url, { signal })
    signal.throwIfAborted()
    destination.signal?.throwIfAborted()
    const family = verifiedAddress(destination)

    upstream = connect({ host: destination.address, port: target.port, family })
    sockets.add(upstream)
    upstream.once('close', () => sockets.delete(upstream))
    await once(upstream, 'connect')
    signal.throwIfAborted()
    await networkPolicy.verifyPeer(upstream, destination)

    if (client.destroyed) {
      upstream.destroy()
      return
    }
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length > 0) upstream.write(head)
    pipeSockets(client, upstream)
  } catch (_error) {
    upstream?.destroy()
    rejectConnect(client, '502 Bad Gateway')
  }
}

async function handleHttpRequest (request, response, networkPolicy, signal, sockets) {
  try {
    const target = new URL(request.url)
    if (target.protocol !== 'http:') {
      throw new TypeError('Certificate proxy only forwards HTTP absolute-form requests')
    }
    // sslcontext-kickstart's AIA loader uses URLConnection#getInputStream(),
    // whose default request method is GET and which does not send a body.
    if (!['GET', 'HEAD'].includes(request.method)) {
      throw new TypeError('Certificate proxy only forwards GET and HEAD requests')
    }
    await networkPolicy.assertUrl(target.href)
    const destination = await networkPolicy.resolve(target.href, { signal })
    signal.throwIfAborted()
    destination.signal?.throwIfAborted()
    const family = verifiedAddress(destination)
    await forwardHttpRequest(request, response, target, destination, family, networkPolicy, signal, sockets)
  } catch (_error) {
    if (response.destroyed) return
    if (!response.headersSent) {
      response.writeHead(502, { Connection: 'close' })
      response.end()
    } else {
      response.socket.destroy()
    }
  }
}

function forwardedHeaders (headers, target) {
  const excluded = new Set(['connection', 'host', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'])
  const nominated = String(headers.connection || '').toLowerCase().split(',').map((name) => name.trim())
  for (const name of nominated) excluded.add(name)
  const output = { host: target.host, connection: 'close' }
  for (const [name, value] of Object.entries(headers)) {
    if (excluded.has(name.toLowerCase()) || value === undefined) continue
    output[name] = value
  }
  return output
}

function forwardHttpRequest (request, response, target, destination, family, networkPolicy, signal, sockets) {
  return new Promise((resolve, reject) => {
    const upstream = httpRequest(target, {
      method: request.method,
      headers: forwardedHeaders(request.headers, target),
      agent: false,
      lookup: destination.lookup || pinnedLookup(destination.address, family),
      family
    })
    upstream.once('socket', (socket) => {
      sockets.add(socket)
      socket.once('close', () => sockets.delete(socket))
      socket.once('connect', () => {
        Promise.resolve().then(() => networkPolicy.verifyPeer(socket, destination)).then(() => {
          signal.throwIfAborted()
          if (response.destroyed) {
            upstream.destroy()
            resolve()
            return
          }
          request.pipe(upstream)
        }, (error) => upstream.destroy(error)).catch((error) => upstream.destroy(error))
      })
    })
    upstream.once('response', (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
      upstreamResponse.once('end', resolve)
      upstreamResponse.once('error', reject)
    })
    upstream.once('error', reject)
  })
}

function pinnedLookup (address, family) {
  return (_hostname, options, callback) => {
    queueMicrotask(() => {
      if (options?.all) callback(null, [{ address, family }])
      else callback(null, address, family)
    })
  }
}

function pipeSockets (first, second) {
  first.once('error', () => second.destroy())
  second.once('error', () => first.destroy())
  first.pipe(second)
  second.pipe(first)
}
