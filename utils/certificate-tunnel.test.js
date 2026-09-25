import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer as createHttpServer } from 'node:http'
import { createServer, connect } from 'node:net'
import test from 'node:test'

import { createCertificateTunnel } from './certificate-tunnel.js'

async function listen (server) {
  server.listen({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')
  const address = server.address()
  return address.port
}

async function close (server) {
  if (server.listening) await new Promise((resolve) => server.close(resolve))
}

function approvedPolicy (port, calls = [], protocol = 'https') {
  return {
    assertUrl (url) {
      calls.push(['assertUrl', url])
      assert.equal(url, `${protocol}://fixture.invalid:${port}/${protocol === 'http' ? 'issuer.der' : ''}`)
    },
    async resolve (url) {
      calls.push(['resolve', url])
      return {
        url: new URL(url),
        hostname: 'fixture.invalid',
        address: '127.0.0.1',
        family: 4
      }
    },
    async verifyPeer (socket, destination) {
      calls.push(['verifyPeer', destination.address])
      assert.equal(socket.remoteAddress, '127.0.0.1')
    }
  }
}

function openTunnel (port, authority, payload) {
  return new Promise((resolve, reject) => {
    const client = connect({ host: '127.0.0.1', port })
    const chunks = []
    let sentPayload = false
    client.on('data', (chunk) => {
      chunks.push(chunk)
      const response = Buffer.concat(chunks)
      if (response.includes(Buffer.from('\r\n\r\n')) && !sentPayload) {
        sentPayload = true
        client.write(payload)
      }
      if (response.includes(payload)) client.end()
    })
    client.once('error', reject)
    client.once('close', () => resolve(Buffer.concat(chunks)))
    client.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
  })
}

function openProxyRequest (port, url) {
  return new Promise((resolve, reject) => {
    const client = connect({ host: '127.0.0.1', port })
    const chunks = []
    client.on('data', (chunk) => chunks.push(chunk))
    client.once('error', reject)
    client.once('close', () => resolve(Buffer.concat(chunks)))
    client.write(`GET ${url} HTTP/1.1\r\nHost: ignored.invalid\r\nConnection: close\r\n\r\n`)
  })
}

function openPipelinedProxyRequests (port, requests) {
  return new Promise((resolve, reject) => {
    const client = connect({ host: '127.0.0.1', port })
    const chunks = []
    client.on('data', (chunk) => chunks.push(chunk))
    client.once('error', reject)
    client.once('close', () => resolve(Buffer.concat(chunks)))
    client.write(requests)
  })
}

test('tunnel approves, pins, verifies, then forwards opaque bytes', async (t) => {
  const origin = createServer((socket) => socket.pipe(socket))
  const originPort = await listen(origin)
  const calls = []
  const tunnel = await createCertificateTunnel(approvedPolicy(originPort, calls))
  t.after(async () => {
    await tunnel.close()
    await close(origin)
  })

  const payload = Buffer.from([0x16, 0x03, 0x01, 0x00, 0x04, 0x54, 0x4c, 0x53, 0x21])
  const response = await openTunnel(tunnel.port, `fixture.invalid:${originPort}`, payload)

  assert.match(response.toString('latin1'), /^HTTP\/1\.1 200 Connection Established\r\n\r\n/)
  assert.deepEqual(response.subarray(response.indexOf(Buffer.from('\r\n\r\n')) + 4), payload)
  assert.deepEqual(calls.map(([name]) => name), ['assertUrl', 'resolve', 'verifyPeer'])
})

test('tunnel does not dial when the policy rejects a target', async (t) => {
  let originConnections = 0
  const origin = createServer(() => { originConnections++ })
  const originPort = await listen(origin)
  const tunnel = await createCertificateTunnel({
    assertUrl () { throw new Error('blocked') },
    async resolve () { throw new Error('resolve must not run') },
    async verifyPeer () { throw new Error('verify must not run') }
  })
  t.after(async () => {
    await tunnel.close()
    await close(origin)
  })

  const response = await openTunnel(tunnel.port, `fixture.invalid:${originPort}`, Buffer.from('unused'))
  assert.match(response.toString(), /^HTTP\/1\.1 502 Bad Gateway\r\n/)
  assert.equal(originConnections, 0)
})

test('tunnel rejects a synchronous peer verification failure', async (t) => {
  let originConnections = 0
  const origin = createServer(() => { originConnections++ })
  const originPort = await listen(origin)
  const tunnel = await createCertificateTunnel({
    assertUrl () {},
    async resolve (url) {
      return { url: new URL(url), hostname: 'fixture.invalid', address: '127.0.0.1', family: 4 }
    },
    verifyPeer () { throw new Error('peer mismatch') }
  })
  t.after(async () => {
    await tunnel.close()
    await close(origin)
  })

  const response = await openTunnel(tunnel.port, `fixture.invalid:${originPort}`, Buffer.from('unused'))
  assert.match(response.toString(), /^HTTP\/1\.1 502 Bad Gateway\r\n/)
  assert.equal(originConnections, 1)
})

test('tunnel forwards policy-approved HTTP issuer requests', async (t) => {
  const requests = []
  const issuer = createHttpServer((request, response) => {
    requests.push({ url: request.url, host: request.headers.host })
    response.end('issuer certificate')
  })
  const issuerPort = await listen(issuer)
  const calls = []
  const tunnel = await createCertificateTunnel(approvedPolicy(issuerPort, calls, 'http'))
  t.after(async () => {
    await tunnel.close()
    await close(issuer)
  })

  const response = await openProxyRequest(tunnel.port, `http://fixture.invalid:${issuerPort}/issuer.der`)
  assert.match(response.toString(), /HTTP\/1\.1 200 OK\r\n/)
  assert.match(response.toString(), /issuer certificate/)
  assert.deepEqual(requests, [{ url: '/issuer.der', host: `fixture.invalid:${issuerPort}` }])
  assert.deepEqual(calls.map(([name]) => name), ['assertUrl', 'resolve', 'verifyPeer'])
})

test('pipelined issuer requests do not bypass the policy', async (t) => {
  let allowedRequests = 0
  let blockedConnections = 0
  const allowed = createHttpServer((_request, response) => {
    allowedRequests++
    response.end('allowed issuer')
  })
  const blocked = createServer(() => { blockedConnections++ })
  const allowedPort = await listen(allowed)
  const blockedPort = await listen(blocked)
  const calls = []
  const tunnel = await createCertificateTunnel({
    assertUrl (url) {
      calls.push(['assertUrl', url])
      if (url.startsWith(`http://blocked.invalid:${blockedPort}/`)) throw new Error('blocked')
    },
    async resolve (url) {
      calls.push(['resolve', url])
      return {
        url: new URL(url),
        hostname: 'allowed.invalid',
        address: '127.0.0.1',
        family: 4
      }
    },
    async verifyPeer (socket, destination) {
      calls.push(['verifyPeer', destination.address])
      assert.equal(socket.remoteAddress, '127.0.0.1')
    }
  })
  t.after(async () => {
    await tunnel.close()
    await close(allowed)
    await close(blocked)
  })

  const requests = [
    `GET http://allowed.invalid:${allowedPort}/issuer.der HTTP/1.1\r\nHost: allowed.invalid\r\nConnection: keep-alive\r\n\r\n`,
    `GET http://blocked.invalid:${blockedPort}/issuer.der HTTP/1.1\r\nHost: blocked.invalid\r\nConnection: close\r\n\r\n`
  ].join('')
  const response = await openPipelinedProxyRequests(tunnel.port, requests)

  assert.match(response.toString(), /allowed issuer/)
  assert.equal(allowedRequests, 1)
  assert.equal(blockedConnections, 0)
  assert.equal(calls.filter(([name]) => name === 'assertUrl').length, 2)
  assert.equal(calls.filter(([name]) => name === 'resolve').length, 1)
  assert.equal(calls.filter(([name]) => name === 'verifyPeer').length, 1)
})

test('close prevents a delayed resolution from opening a socket', async (t) => {
  let resolveDestination
  const destination = new Promise((resolve) => { resolveDestination = resolve })
  let originConnections = 0
  const origin = createServer(() => { originConnections++ })
  const originPort = await listen(origin)
  const tunnel = await createCertificateTunnel({
    assertUrl () {},
    async resolve () { return destination },
    async verifyPeer () { throw new Error('verify must not run') }
  })
  t.after(async () => close(origin))

  const client = connect({ host: tunnel.host, port: tunnel.port })
  client.on('error', () => {})
  client.write(`CONNECT fixture.invalid:${originPort} HTTP/1.1\r\nHost: fixture.invalid\r\n\r\n`)
  await new Promise((resolve) => setImmediate(resolve))
  await tunnel.close()
  resolveDestination({
    url: new URL(`https://fixture.invalid:${originPort}/`),
    hostname: 'fixture.invalid',
    address: '127.0.0.1',
    family: 4
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(originConnections, 0)
})

test('an external abort during startup does not leave a listener', async () => {
  const controller = new AbortController()
  const tunnel = createCertificateTunnel({
    assertUrl () {},
    async resolve () { throw new Error('resolve must not run') },
    async verifyPeer () { throw new Error('verify must not run') }
  }, { signal: controller.signal })
  controller.abort(new Error('test abort'))
  await assert.rejects(tunnel, /test abort/)
})
