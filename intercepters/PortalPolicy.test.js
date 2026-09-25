import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import tls from 'node:tls'
import { once } from 'node:events'
import { Duplex, PassThrough } from 'node:stream'
import { createServer, clientDefaults, requestUrl } from '@harvard-lil/portal'
import { NetworkPolicy } from '../utils/network.js'

const response = Buffer.from('HTTP/1.1 200 Original Reason\r\nX-Weird:   padded   \r\nX-Dupe: one\r\nX-Dupe: two\r\nContent-Length: 3\r\n\r\nabc')

async function fixture (t, { rules = [], secure = false, handle, lookup, beforeDial, verifyPeer, responseTransformer } = {}) {
  const sockets = new Set()
  const received = []
  let connections = 0
  const originHandler = socket => {
    sockets.add(socket)
    let pending = Buffer.alloc(0)
    socket.on('error', () => {})
    socket.on('data', chunk => {
      received.push(chunk)
      pending = Buffer.concat([pending, chunk])
      if (handle) handle(socket, pending)
      else if (pending.includes('\r\n\r\n') || pending.includes('\n\n')) {
        pending = Buffer.alloc(0)
        socket.write(response)
      }
    })
  }
  const origin = secure ? tls.createServer(clientDefaults, originHandler) : net.createServer(originHandler)
  origin.on('connection', socket => { connections++; sockets.add(socket) })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  const errors = []; const denials = []; const requestRaw = []; const responseRaw = []
  const policy = new NetworkPolicy(rules, (...args) => denials.push(args), lookup ? { lookup } : {})
  const proxy = createServer({
    authorizeRequest: (req, signal) => policy.resolve(requestUrl(req), { signal }),
    verifyPeer: verifyPeer || ((socket, destination) => policy.verifyPeer(socket, destination)),
    serverOptions: () => { beforeDial?.(policy); return { rejectUnauthorized: false } },
    requestTransformer: () => {
      const stream = new PassThrough()
      stream.on('data', data => requestRaw.push(data))
      return stream
    },
    responseTransformer: responseTransformer || (() => {
      const stream = new PassThrough()
      stream.on('data', data => responseRaw.push(data))
      return stream
    })
  })
  proxy.on('error', (error, upstream, request) => {
    errors.push(error)
    if (request?.socket.writable) request.socket.end(`HTTP/1.1 ${error.code === 'ERR_NETWORK_POLICY' ? '403 Forbidden' : '400 Bad Request'}\r\nContent-Length: 0\r\n\r\n`)
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  t.after(async () => {
    policy.close()
    proxy.destroyConnections()
    for (const socket of sockets) socket.destroy()
    await Promise.all([new Promise(resolve => proxy.close(resolve)), new Promise(resolve => origin.close(resolve))])
  })
  return {
    proxy,
    origin,
    errors,
    denials,
    requestRaw,
    responseRaw,
    received,
    get connections () { return connections },
    url: `${secure ? 'https' : 'http'}://127.0.0.1:${origin.address().port}`
  }
}

async function client (t, proxy, expected, send) {
  const socket = net.connect(proxy.address().port, '127.0.0.1')
  t.after(() => socket.destroy())
  socket.on('error', () => {})
  const chunks = []
  const complete = new Promise((resolve, reject) => {
    socket.on('data', chunk => {
      chunks.push(chunk)
      if (expected(Buffer.concat(chunks))) resolve(Buffer.concat(chunks))
    })
    socket.once('close', () => resolve(Buffer.concat(chunks)))
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Fixture client timed out')) })
  })
  await send(socket)
  return await complete
}

const request = (url, path = '/', extra = '') => `GET ${url}${path} HTTP/1.1\r\nHost: ${new URL(url).host}\r\n${extra}\r\n`

test('denied first URL and denied literal IP never create an upstream socket', async t => {
  for (const rules of [['/denied/'], ['127.0.0.0/8']]) {
    const f = await fixture(t, { rules })
    const output = await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(request(f.url, '/denied')))
    assert.match(output.toString(), /403 Forbidden/)
    assert.equal(f.connections, 0)
    assert.equal(f.received.length, 0)
    assert.equal(f.requestRaw.length, 0)
  }
})

test('pipelined allowed, allowed, denied messages preserve bytes and reuse one upstream socket', async t => {
  const f = await fixture(t, { rules: ['/denied/'] })
  const allowed = request(f.url, '/one', 'X-Weird:   padded   \r\nX-Dupe: one\r\nX-Dupe: two\r\n') + request(f.url, '/two')
  const output = await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(allowed + request(f.url, '/denied')))
  assert.equal(Buffer.concat(f.received).toString(), allowed)
  assert.equal(Buffer.concat(f.requestRaw).toString(), allowed)
  assert.ok(output.subarray(0, response.length * 2).equals(Buffer.concat([response, response])))
  assert.ok(Buffer.concat(f.responseRaw).equals(Buffer.concat([response, response])))
  assert.equal(f.connections, 1)
})

test('a failed pinned TLS connection reports an error without crashing the proxy', async t => {
  const f = await fixture(t, {
    secure: true,
    lookup: async () => [{ address: '::1', family: 6 }]
  })
  const output = await client(t, f.proxy, bytes => bytes.includes('400'), socket => socket.write(request(f.url.replace('127.0.0.1', 'fixture.test'))))
  assert.match(output.toString(), /400 Bad Request/)
  assert.ok(f.errors.some(error => ['ECONNREFUSED', 'ENETUNREACH', 'EADDRNOTAVAIL'].includes(error.code)))
  assert.equal(f.received.length, 0)
})

test('reusing an upstream socket does not accumulate tracking listeners', async t => {
  const f = await fixture(t)
  const counts = []
  f.proxy.on('connected', socket => counts.push(socket.listenerCount('close')))
  await client(t, f.proxy, bytes => bytes.length >= response.length * 30, socket => {
    socket.write(Array.from({ length: 30 }, (_, i) => request(f.url, `/${i}`)).join(''))
  })
  assert.equal(f.connections, 1)
  assert.equal(counts.length, 30)
  assert.equal(counts.at(-1), counts[1])
})

test('split content-length body cannot release a partial denied next header', async t => {
  let replied = false
  const f = await fixture(t, {
    rules: ['/denied/'],
    handle: (socket, bytes) => {
      if (!replied && bytes.includes('\r\n\r\nbody')) { replied = true; socket.write(response) }
    }
  })
  const allowed = `POST ${f.url}/allowed HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\nContent-Length: 4\r\n\r\nbody`
  const denied = request(f.url, '/denied')
  await client(t, f.proxy, bytes => bytes.includes('403'), async socket => {
    socket.write(allowed.slice(0, -2))
    await new Promise(resolve => setTimeout(resolve, 5))
    socket.write(allowed.slice(-2) + denied.slice(0, -3))
    await new Promise(resolve => setTimeout(resolve, 5))
    socket.write(denied.slice(-3))
  })
  assert.equal(Buffer.concat(f.received).toString(), allowed)
  assert.equal(f.connections, 1)
})

test('chunk extensions, trailers and following denied request retain exact permitted range', async t => {
  let replied = false
  const f = await fixture(t, {
    rules: ['/denied/'],
    handle: (socket, bytes) => {
      if (!replied && bytes.includes('X-Trail:   tail   \r\n\r\n')) { replied = true; socket.write(response) }
    }
  })
  const allowed = `POST ${f.url}/allowed HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\nTransfer-Encoding: chunked\r\nTrailer: X-Trail\r\n\r\n03;foo=bar\r\nabc\r\n0\r\nX-Trail:   tail   \r\n\r\n`
  await client(t, f.proxy, bytes => bytes.includes('403'), async socket => {
    for (let offset = 0; offset < allowed.length; offset += 7) socket.write(allowed.slice(offset, offset + 7))
    socket.write(request(f.url, '/denied'))
  })
  assert.equal(Buffer.concat(f.received).toString(), allowed)
  assert.equal(Buffer.concat(f.requestRaw).toString(), allowed)
})

test('Expect 100-continue and 103 are forwarded unchanged without waiting for request body', async t => {
  const info = Buffer.from('HTTP/1.1 103 Early Hints\r\nLink: </style.css>\r\n\r\nHTTP/1.1 100 Continue\r\n\r\n')
  let hinted = false; let replied = false
  const f = await fixture(t, {
    handle: (socket, bytes) => {
      if (!hinted && bytes.includes('\r\n\r\n')) { hinted = true; socket.write(info) }
      if (!replied && bytes.includes('\r\n\r\nbody')) { replied = true; socket.write(response) }
    }
  })
  const head = `POST ${f.url}/ HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\nContent-Length: 4\r\nExpect: 100-continue\r\n\r\n`
  const output = await client(t, f.proxy, bytes => bytes.length === info.length + response.length, socket => {
    let sent = false
    socket.on('data', bytes => { if (!sent && bytes.includes('100 Continue')) { sent = true; socket.write('body') } })
    socket.write(head)
  })
  assert.ok(output.equals(Buffer.concat([info, response])))
  assert.equal(Buffer.concat(f.received).toString(), head + 'body')
  assert.ok(Buffer.concat(f.responseRaw).equals(output))
  assert.equal(f.errors.length, 0)
})

test('LF-only requests rejected by Node fail before upstream connection', async t => {
  const f = await fixture(t)
  const raw = `GET ${f.url}/ HTTP/1.1\nHost: ${new URL(f.url).host}\n\n`
  await client(t, f.proxy, bytes => bytes.length === response.length, socket => socket.write(raw))
  assert.equal(f.connections, 0)
  assert.equal(f.errors[0].code, 'HPE_INVALID_VERSION')
})

async function tunnel (t, f) {
  const socket = net.connect(f.proxy.address().port, '127.0.0.1')
  t.after(() => socket.destroy())
  socket.on('error', () => {})
  socket.setTimeout(2000, () => socket.destroy(new Error('CONNECT timed out')))
  const accepted = once(socket, 'data')
  const authority = new URL(f.url).host
  socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`)
  assert.match((await accepted)[0].toString(), /200 Connection Established/)
  const client = tls.connect({ socket, rejectUnauthorized: false, servername: 'localhost' })
  t.after(() => client.destroy())
  client.on('error', () => {})
  await once(client, 'secureConnect')
  return client
}

async function until (socket, predicate, send) {
  const chunks = []
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TLS/upgrade fixture timed out')), 2000)
    const finish = data => { clearTimeout(timer); socket.off('data', onData); resolve(data) }
    const onData = chunk => { chunks.push(chunk); const data = Buffer.concat(chunks); if (predicate(data)) finish(data) }
    socket.on('data', onData)
    socket.once('close', () => finish(Buffer.concat(chunks)))
  })
  send()
  return await result
}

test('HTTPS CONNECT keeps allowed inner requests exact and blocks pipelined denied URL', async t => {
  const f = await fixture(t, { secure: true, rules: ['/denied/'] })
  const socket = await tunnel(t, f)
  const allowed = `GET /one HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\nX-Weird:   padded   \r\n\r\n`
  const output = await until(socket, bytes => bytes.includes('403'), () => socket.write(allowed + `GET /denied HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\n\r\n`))
  assert.equal(Buffer.concat(f.received).toString(), allowed)
  assert.equal(Buffer.concat(f.requestRaw).toString(), allowed)
  assert.ok(output.subarray(0, response.length).equals(response))
  assert.equal(f.errors.filter(error => error.code !== 'ERR_NETWORK_POLICY').length, 0)
})

test('CONNECT authority mismatch and forbidden CONNECT fail before dialing', async t => {
  const f = await fixture(t, { secure: true, rules: ['/denied/'] })
  const authority = new URL(f.url).host
  await client(t, f.proxy, () => false, socket => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: denied.invalid\r\n\r\n`))
  assert.equal(f.connections, 0)
  assert.equal(f.received.length, 0)
  const blocked = await fixture(t, { rules: ['127.0.0.0/8'] })
  const host = new URL(blocked.url).host
  await client(t, blocked.proxy, () => false, socket => socket.write(`CONNECT ${host} HTTP/1.1\r\nHost: ${host}\r\n\r\n`))
  assert.equal(blocked.connections, 0)
})

test('CONNECT inner Host mismatch cannot route to another destination', async t => {
  const f = await fixture(t, { secure: true })
  const socket = await tunnel(t, f)
  const output = await until(socket, bytes => bytes.includes('400'), () => socket.write('GET / HTTP/1.1\r\nHost: other.invalid\r\n\r\n'))
  assert.match(output.toString(), /400 Bad Request/)
  assert.equal(f.received.length, 0)
  assert.equal(f.connections, 1) // Only the approved CONNECT preflight socket.
})

test('approved Upgrade releases raw duplex bytes only after the 101 response', async t => {
  const handshake = Buffer.from('HTTP/1.1 101 Switching Protocols\r\nUpgrade: fixture\r\nConnection: Upgrade\r\nX-Weird:   padded   \r\n\r\n')
  let switched = false
  let earlyBytes = null
  const opaque = Buffer.from([0, 255, 13, 10, 1, 2, 3])
  const f = await fixture(t, {
    handle: (socket, bytes) => {
      if (!switched && bytes.includes('\r\n\r\n')) {
        switched = true
        earlyBytes = Buffer.from(bytes)
        socket.write(handshake)
      } else if (switched && bytes.subarray(-opaque.length).equals(opaque)) socket.write(opaque)
    }
  })
  const head = request(f.url, '/upgrade', 'Connection: Upgrade\r\nUpgrade: fixture\r\n')
  const output = await client(t, f.proxy, bytes => bytes.length === handshake.length + opaque.length, socket => socket.write(Buffer.concat([Buffer.from(head), opaque])))
  assert.equal(earlyBytes.toString(), head)
  assert.ok(output.equals(Buffer.concat([handshake, opaque])))
  assert.ok(Buffer.concat(f.received).equals(Buffer.concat([Buffer.from(head), opaque])))
  assert.equal(f.errors.length, 0)
})

test('denied upgrade never forwards its handshake or opaque payload', async t => {
  const f = await fixture(t, { rules: ['/denied/'] })
  await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(request(f.url, '/denied', 'Connection: Upgrade\r\nUpgrade: fixture\r\n') + 'opaque'))
  assert.equal(f.connections, 0)
  assert.equal(f.received.length, 0)
})

test('ambiguous Content-Length plus Transfer-Encoding is rejected before any upstream bytes', async t => {
  const f = await fixture(t)
  await client(t, f.proxy, () => false, socket => socket.write(`POST ${f.url}/ HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\nContent-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n`))
  assert.equal(f.connections, 0)
  assert.equal(f.received.length, 0)
  assert.match(f.errors[0].code, /^HPE_(UNEXPECTED_CONTENT_LENGTH|INVALID_TRANSFER_ENCODING)$/)
})

test('DNS changes are rechecked before a pooled connection can send another request', async t => {
  let lookups = 0
  const f = await fixture(t, {
    rules: ['127.0.0.2'],
    lookup: async () => [{ address: ++lookups === 1 ? '127.0.0.1' : '127.0.0.2', family: 4 }]
  })
  const hostname = f.url.replace('127.0.0.1', 'fixture.invalid')
  const first = request(hostname, '/first')
  await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(first + request(hostname, '/second')))
  assert.equal(Buffer.concat(f.received).toString(), first)
  assert.equal(f.connections, 1)
  assert.equal(lookups, 2)
})

test('chunked response extensions and trailers reach client and capture unchanged', async t => {
  const raw = Buffer.from('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nTrailer: X-Trail\r\n\r\n03;foo=bar\r\nabc\r\n0\r\nX-Trail:   tail   \r\n\r\n')
  let sent = false
  const f = await fixture(t, {
    handle: (socket, bytes) => {
      if (!sent && bytes.includes('\r\n\r\n')) { sent = true; socket.write(raw) }
    }
  })
  const output = await client(t, f.proxy, bytes => bytes.length === raw.length, socket => socket.write(request(f.url)))
  assert.ok(output.equals(raw))
  assert.ok(Buffer.concat(f.responseRaw).equals(raw))
})

test('closing one proxy leaves another capture connection and its pool intact', async t => {
  const first = await fixture(t)
  const second = await fixture(t)
  const socket = net.connect(second.proxy.address().port, '127.0.0.1')
  t.after(() => socket.destroy())
  socket.on('error', () => {})
  await until(socket, bytes => bytes.length === response.length, () => socket.write(request(second.url, '/one')))
  first.proxy.destroyConnections()
  await until(socket, bytes => bytes.length === response.length, () => socket.write(request(second.url, '/two')))
  assert.equal(second.connections, 1)
  assert.equal(second.errors.length, 0)
})

test('disconnect or proxy teardown during DNS cannot create a late upstream connection', async t => {
  for (const shutdown of [false, true]) {
    let resolveDns, started
    const waiting = new Promise(resolve => { started = resolve })
    const f = await fixture(t, {
      lookup: () => {
        started()
        return new Promise(resolve => { resolveDns = resolve })
      }
    })
    const accepted = once(f.proxy, 'connection')
    const socket = net.connect(f.proxy.address().port, '127.0.0.1')
    socket.on('error', () => {})
    socket.write(request(f.url.replace('127.0.0.1', 'fixture.invalid')))
    const [serverSocket] = await accepted
    await waiting
    const closed = once(socket, 'close')
    const serverClosed = new Promise(resolve => serverSocket.once('close', resolve))
    if (shutdown) f.proxy.destroyConnections()
    else socket.resetAndDestroy()
    await closed
    await serverClosed
    resolveDns([{ address: '127.0.0.1', family: 4 }])
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(f.connections, 0)
  }
})

test('framing reads Content-Length beyond the native header-count default', async t => {
  let replied = false
  const f = await fixture(t, {
    rules: ['/denied/'],
    handle: (socket, bytes) => {
      if (!replied && bytes.includes('\r\n\r\nbody')) { replied = true; socket.write(response) }
    }
  })
  const headers = Array.from({ length: 1100 }, () => 'X: y\r\n').join('')
  const raw = `POST ${f.url}/ HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\n${headers}Content-Length: 4\r\n\r\nbody`
  await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(raw + request(f.url, '/denied')))
  assert.equal(Buffer.concat(f.received).toString(), raw)
})

test('duplicate Host fields cannot forward a second forbidden authority', async t => {
  const f = await fixture(t, { rules: ['/blocked.invalid/'] })
  const host = new URL(f.url).host
  for (const target of [`${f.url}/`, '/']) {
    await client(t, f.proxy, () => false, socket => socket.write(`GET ${target} HTTP/1.1\r\nHost: ${host}\r\nhOsT: blocked.invalid\r\n\r\n`))
  }
  assert.equal(f.connections, 0)
  assert.equal(f.requestRaw.length, 0)
  assert.ok(f.errors.every(error => /Multiple Host/.test(error.message)))
})

test('missing origin-form authority and malformed CONNECT authority fail before DNS', async t => {
  let lookups = 0
  const f = await fixture(t, { lookup: async () => { lookups++; return [{ address: '127.0.0.1', family: 4 }] } })
  for (const raw of [
    'GET / HTTP/1.1\r\n\r\n',
    'OPTIONS * HTTP/1.1\r\n\r\n',
    'CONNECT host.invalid:443/path HTTP/1.1\r\n\r\n',
    'CONNECT user@host.invalid:443 HTTP/1.1\r\n\r\n',
    'CONNECT host.invalid:443?query HTTP/1.1\r\n\r\n'
  ]) await client(t, f.proxy, () => false, socket => socket.write(raw))
  assert.equal(lookups, 0)
  assert.equal(f.connections, 0)
})

test('policy closure after resolution prevents a new socket independently of gate closure', async t => {
  const f = await fixture(t, { beforeDial: policy => policy.close() })
  await client(t, f.proxy, () => false, socket => socket.write(request(f.url)))
  assert.equal(f.connections, 0)
  assert.equal(f.received.length, 0)
})

test('CONNECT and a TLS ClientHello in the same TCP write preserve the tunnel bytes', async t => {
  const f = await fixture(t, { secure: true })
  const socket = net.connect(f.proxy.address().port, '127.0.0.1')
  socket.on('error', () => {})
  t.after(() => socket.destroy())
  let helloReady
  const ready = new Promise(resolve => { helloReady = resolve })
  let sentConnect = false
  const early = []
  const transport = new Duplex({
    read () {},
    write (data, encoding, callback) {
      if (sentConnect) socket.write(data, encoding, callback)
      else { early.push(Buffer.from(data)); callback(); helloReady() }
    }
  })
  let responseHeader = Buffer.alloc(0)
  let accepted = false
  socket.on('data', data => {
    if (accepted) transport.push(data)
    else {
      responseHeader = Buffer.concat([responseHeader, data])
      const end = responseHeader.indexOf('\r\n\r\n')
      if (end >= 0) {
        assert.match(responseHeader.subarray(0, end).toString(), /200 Connection Established/)
        accepted = true
        transport.push(responseHeader.subarray(end + 4))
      }
    }
  })
  const browser = tls.connect({ socket: transport, rejectUnauthorized: false, servername: 'localhost' })
  browser.on('error', () => {})
  t.after(() => { browser.destroy(); transport.destroy() })
  const secured = once(browser, 'secureConnect')
  await ready
  const authority = new URL(f.url).host
  sentConnect = true
  socket.write(Buffer.concat([Buffer.from(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`), ...early]))
  await secured
  const raw = `GET / HTTP/1.1\r\nHost: ${authority}\r\n\r\n`
  const output = await until(browser, bytes => bytes.length === response.length, () => browser.write(raw))
  assert.ok(output.equals(response))
  assert.equal(Buffer.concat(f.received).toString(), raw)
  assert.equal(f.errors.length, 0)
})

test('surplus origin responses cannot poison a pipelined denied exchange', async t => {
  const injected = 'HTTP/1.1 299 Injected\r\nContent-Length: 6\r\n\r\npoison'
  for (const [method, first] of [
    ['GET', 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n'],
    ['GET', 'HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\nabc'],
    ['HEAD', 'HTTP/1.1 200 OK\r\nContent-Length: 123\r\n\r\n'],
    ['GET', 'HTTP/1.1 204 No Content\r\n\r\n'],
    ['GET', 'HTTP/1.1 304 Not Modified\r\nContent-Length: 123\r\n\r\n'],
    ['GET', 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n1\r\na\r\n0\r\nX-Trail: yes\r\n\r\n']
  ]) {
    let sent = false
    const f = await fixture(t, {
      rules: ['/denied/'],
      handle: (socket, bytes) => {
        if (!sent && bytes.includes('\r\n\r\n')) { sent = true; socket.write(first + injected) }
      }
    })
    const allowed = request(f.url, '/allowed').replace('GET ', `${method} `)
    const output = await client(t, f.proxy, () => false, socket => socket.write(allowed + request(f.url, '/denied')))
    assert.equal(Buffer.concat(f.received).toString(), allowed)
    assert.equal(f.connections, 1)
    assert.equal(output.includes('299 Injected'), false)
    assert.equal(Buffer.concat(f.responseRaw).includes('299 Injected'), false)
    assert.ok(f.errors.length > 0)
  }
})

test('late surplus bytes on an idle origin connection cannot enter the capture', async t => {
  let sent = false
  let originClosed
  const closed = new Promise(resolve => { originClosed = resolve })
  const f = await fixture(t, {
    handle: (socket, bytes) => {
      if (!sent && bytes.includes('\r\n\r\n')) {
        sent = true
        socket.once('close', originClosed)
        socket.write(response)
        setTimeout(() => { if (!socket.destroyed) socket.write('HTTP/1.1 299 Injected\r\nContent-Length: 0\r\n\r\n') }, 15)
      }
    }
  })
  const output = await client(t, f.proxy, () => false, async socket => {
    socket.write(request(f.url))
    await closed
    socket.end()
  })
  assert.ok(output.subarray(0, response.length).equals(response))
  assert.equal(output.includes('299 Injected'), false)
  assert.ok(Buffer.concat(f.responseRaw).equals(response))
})

test('HEAD, 204 and 304 responses retain exact headers and permit the next checked request', async t => {
  for (const [method, raw] of [
    ['HEAD', 'HTTP/1.1 200 OK\r\nContent-Length: 123\r\n\r\n'],
    ['GET', 'HTTP/1.1 204 No Content\r\n\r\n'],
    ['GET', 'HTTP/1.1 304 Not Modified\r\nContent-Length: 123\r\n\r\n']
  ]) {
    const f = await fixture(t, { rules: ['/denied/'], handle: socket => socket.write(raw) })
    const first = request(f.url).replace('GET ', `${method} `)
    const output = await client(t, f.proxy, bytes => bytes.includes('403'), socket => socket.write(first + request(f.url, '/denied')))
    assert.equal(output.subarray(0, raw.length).toString(), raw)
    assert.equal(Buffer.concat(f.responseRaw).toString(), raw)
    assert.equal(Buffer.concat(f.received).toString(), first)
  }
})

test('close-delimited responses preserve bytes and close the downstream connection', async t => {
  const raw = 'HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nbody without a length'
  const f = await fixture(t, { handle: socket => socket.end(raw) })
  const output = await client(t, f.proxy, () => false, socket => socket.write(request(f.url)))
  assert.equal(output.toString(), raw)
  assert.equal(Buffer.concat(f.responseRaw).toString(), raw)
  assert.equal(f.errors.length, 0)
})

test('ambiguous response framing is rejected without entering the raw capture', async t => {
  for (const headers of [
    'Content-Length: 0\r\nTransfer-Encoding: chunked\r\n',
    'Content-Length: 0\r\nContent-Length: 0\r\n',
    'Content-Length: 00\r\n',
    'Transfer-Encoding: gzip, chunked\r\n',
    'Content-Length: 0\r\nConnection: Content-Length\r\n'
  ]) {
    const f = await fixture(t, { handle: socket => socket.end(`HTTP/1.1 200 OK\r\n${headers}\r\n`) })
    await client(t, f.proxy, () => false, socket => socket.write(request(f.url)))
    assert.equal(f.responseRaw.length, 0)
    assert.ok(f.errors.length > 0)
  }
})

test('unsupported request framing fails before any upstream connection', async t => {
  for (const headers of [
    'Transfer-Encoding: gzip, chunked\r\n',
    'Content-Length: 00\r\n',
    'Content-Length: 0\r\nConnection: content-length\r\n',
    'Transfer-Encoding: chunked\r\nConnection: transfer-encoding\r\n'
  ]) {
    const f = await fixture(t)
    await client(t, f.proxy, () => false, socket => socket.write(`POST ${f.url}/ HTTP/1.1\r\nHost: ${new URL(f.url).host}\r\n${headers}\r\n0\r\n\r\n`))
    assert.equal(f.connections, 0)
    assert.equal(f.requestRaw.length, 0)
  }
})

test('an asynchronous peer denial rejects before forwarding or recording request bytes', async t => {
  const f = await fixture(t, {
    verifyPeer: async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      throw new Error('Fixture peer denial')
    }
  })
  await client(t, f.proxy, () => false, socket => socket.write(request(f.url)))
  assert.equal(f.connections, 1)
  assert.equal(f.received.length, 0)
  assert.equal(f.requestRaw.length, 0)
  assert.ok(f.errors.some(error => error.message === 'Fixture peer denial'))
})

test('malformed Host and conflicting allowed authorities fail before DNS or forwarding', async t => {
  let lookups = 0
  const f = await fixture(t, {
    rules: ['/\\/blocked$/'],
    lookup: async () => {
      lookups++
      return [{ address: '127.0.0.1', family: 4 }]
    }
  })
  const authority = `fixture.invalid:${f.origin.address().port}`
  for (const host of [`${authority}/safe`, `user@${authority}`, `${authority}?safe`, `${authority}#safe`, `${authority}\\safe`]) {
    await client(t, f.proxy, () => false, socket => socket.write(`GET /blocked HTTP/1.1\r\nHost: ${host}\r\n\r\n`))
  }
  await client(t, f.proxy, () => false, socket => socket.write(`GET http://${authority}/allowed HTTP/1.1\r\nHost: other.invalid\r\n\r\n`))
  await client(t, f.proxy, () => false, socket => socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}/safe\r\n\r\n`))
  assert.equal(lookups, 0)
  assert.equal(f.connections, 0)
  assert.equal(f.requestRaw.length, 0)
})

test('destination port zero is rejected before DNS while listener port zero remains supported', async t => {
  let lookups = 0
  const f = await fixture(t, { lookup: async () => { lookups++; return [{ address: '127.0.0.1', family: 4 }] } })
  for (const raw of [
    'GET http://fixture.invalid:0/ HTTP/1.1\r\nHost: fixture.invalid:0\r\n\r\n',
    'GET / HTTP/1.1\r\nHost: fixture.invalid:0\r\n\r\n',
    'CONNECT fixture.invalid:0 HTTP/1.1\r\nHost: fixture.invalid:0\r\n\r\n'
  ]) await client(t, f.proxy, () => false, socket => socket.write(raw))
  assert.ok(f.proxy.address().port > 0)
  assert.equal(lookups, 0)
  assert.equal(f.connections, 0)
})

test('an asynchronous response transformer failure closes the request without an unhandled rejection', async t => {
  const f = await fixture(t, {
    responseTransformer: async () => { throw new Error('Fixture transformer failure') }
  })
  await client(t, f.proxy, () => false, socket => socket.write(request(f.url)))
  assert.equal(f.responseRaw.length, 0)
  assert.ok(f.errors.some(error => error.message === 'Fixture transformer failure'))
})
