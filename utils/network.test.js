import assert from 'node:assert/strict'
import { once } from 'node:events'
import http from 'node:http'
import test from 'node:test'
import { NetworkPolicy, fetchHead, normalizeAddress } from './network.js'

async function origin (t, handler) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return { server, url: `http://127.0.0.1:${server.address().port}` }
}

test('HEAD rejects blocked literal and resolved destinations before opening a connection', async t => {
  let connections = 0
  const { server, url } = await origin(t, (_req, res) => res.end())
  server.on('connection', () => { connections++ })
  const policy = new NetworkPolicy(['127.0.0.0/8'], () => {}, {
    lookup: async () => [{ address: '127.0.0.1', family: 4 }]
  })
  await assert.rejects(fetchHead(url, policy), { code: 'ERR_NETWORK_POLICY' })
  await assert.rejects(fetchHead(url.replace('127.0.0.1', 'fixture.test'), policy), { code: 'ERR_NETWORK_POLICY' })
  assert.equal(connections, 0)
})

test('HEAD redirects recheck the full URL before forwarding', async t => {
  const requests = []
  const { url } = await origin(t, (req, res) => {
    requests.push(req.url)
    res.writeHead(302, { location: '/blocked' })
    res.end()
  })
  await assert.rejects(fetchHead(url, new NetworkPolicy(['/\\/blocked$/'])), { code: 'ERR_NETWORK_POLICY' })
  assert.deepEqual(requests, ['/'])
})

test('HEAD pins the approved DNS result while preserving the hostname and metadata', async t => {
  let lookups = 0
  const { url } = await origin(t, (req, res) => {
    assert.ok(req.headers.host.startsWith('fixture.test:'))
    assert.equal(req.method, 'HEAD')
    res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': '100' })
    res.end()
  })
  const policy = new NetworkPolicy(['10.0.0.0/8'], () => {}, {
    lookup: async () => [{ address: ++lookups === 1 ? '127.0.0.1' : '10.0.0.1', family: 4 }]
  })
  const target = url.replace('127.0.0.1', 'fixture.test') + '/document'
  const result = await fetchHead(target, policy)
  assert.equal(result.url, target)
  assert.equal(result.headers.get('content-type'), 'application/pdf')
  assert.equal(result.headers.get('content-length'), '100')
  assert.equal(lookups, 1)
})

test('approved redirects retain HEAD and check DNS again for each connection', async t => {
  let lookups = 0
  const requests = []
  const { url } = await origin(t, (req, res) => {
    requests.push([req.method, req.url])
    if (req.url === '/') res.writeHead(302, { location: '/final' })
    res.end()
  })
  const policy = new NetworkPolicy([], () => {}, {
    lookup: async () => { lookups++; return [{ address: '127.0.0.1', family: 4 }] }
  })
  const result = await fetchHead(url.replace('127.0.0.1', 'fixture.test'), policy)
  assert.equal(new URL(result.url).pathname, '/final')
  assert.equal(lookups, 2)
  assert.deepEqual(requests, [['HEAD', '/'], ['HEAD', '/final']])
})

test('a redirect whose fresh DNS answer becomes blocked opens no second connection', async t => {
  let lookups = 0
  let connections = 0
  const { server, url } = await origin(t, (_req, res) => { res.writeHead(302, { location: '/next' }); res.end() })
  server.on('connection', () => { connections++ })
  const policy = new NetworkPolicy(['10.0.0.0/8'], () => {}, {
    lookup: async () => [{ address: ++lookups === 1 ? '127.0.0.1' : '10.0.0.1', family: 4 }]
  })
  await assert.rejects(fetchHead(url.replace('127.0.0.1', 'fixture.test'), policy), { code: 'ERR_NETWORK_POLICY' })
  assert.equal(connections, 1)
})

test('mixed DNS answers select an allowed address and pin both lookup callback forms', async () => {
  const denied = []
  const policy = new NetworkPolicy(['127.0.0.0/8'], (...args) => denied.push(args), {
    lookup: async () => [{ address: '127.0.0.1', family: 4 }, { address: '93.184.216.34', family: 4 }]
  })
  const destination = await policy.resolve('https://fixture.test/')
  assert.equal(destination.address, '93.184.216.34')
  destination.lookup('fixture.test', {}, (error, address, family) => {
    assert.equal(error, null)
    assert.equal(address, destination.address)
    assert.equal(family, 4)
  })
  destination.lookup('fixture.test', { all: true }, (error, addresses) => {
    assert.equal(error, null)
    assert.deepEqual(addresses, [{ address: destination.address, family: 4 }])
  })
  assert.deepEqual(denied, [])
})

test('IPv4-mapped IPv6 cannot bypass IPv4-only rules', async () => {
  const policy = new NetworkPolicy(['127.0.0.0/8'])
  for (const address of ['[::ffff:127.0.0.1]', '[::ffff:7f00:1]']) {
    await assert.rejects(policy.resolve(`http://${address}/`), { code: 'ERR_NETWORK_POLICY' })
  }
  assert.equal(normalizeAddress('::ffff:7f00:1'), '127.0.0.1')
})

test('DNS requests IPv4-first ordering and still excludes blocked answers', async () => {
  const policy = new NetworkPolicy(['10.0.0.0/8'], () => {}, {
    lookup: async (hostname, options) => {
      assert.equal(options.order, 'ipv4first')
      assert.equal(options.all, true)
      return [{ address: '10.0.0.1', family: 4 }, { address: '93.184.216.34', family: 4 }, { address: '2001:4860::1', family: 6 }]
    }
  })
  assert.equal((await policy.resolve('https://fixture.test/')).address, '93.184.216.34')
})

test('pinned lookup is asynchronous and rechecks cancellation before delivering an address', async () => {
  const policy = new NetworkPolicy([])
  const destination = await policy.resolve('http://127.0.0.1/')
  let called = false
  const pending = new Promise(resolve => destination.lookup('ignored', {}, error => {
    called = true
    assert.equal(error.code, 'ERR_NETWORK_POLICY')
    resolve()
  }))
  assert.equal(called, false)
  policy.close()
  await pending
})

test('explicit destination port zero is rejected instead of becoming the protocol default', async () => {
  const policy = new NetworkPolicy([])
  for (const url of ['http://fixture.test:0/', 'https://fixture.test:00000/']) {
    assert.throws(() => policy.assertUrl(url), { code: 'ERR_NETWORK_POLICY' })
    await assert.rejects(policy.resolve(url), { code: 'ERR_NETWORK_POLICY' })
  }
})

test('peer verification destroys a socket connected to an unapproved peer', () => {
  let destroyed = false
  const socket = { remoteAddress: '127.0.0.1', destroy: () => { destroyed = true } }
  assert.throws(() => new NetworkPolicy([]).verifyPeer(socket, { address: '93.184.216.34' }), { code: 'ERR_NETWORK_POLICY' })
  assert.equal(destroyed, true)
})

test('HEAD keeps the existing Node fetch HTTP request header bytes', async t => {
  const requests = []
  const { url } = await origin(t, (req, res) => { requests.push(req.rawHeaders); res.end() })
  await fetch(url, { method: 'HEAD' })
  await fetchHead(url, new NetworkPolicy([]))
  assert.deepEqual(requests[1], requests[0])
})

test('aborting or closing a policy cancels pending DNS consumers', async () => {
  const policy = new NetworkPolicy([], () => {}, { lookup: () => new Promise(() => {}) })
  const controller = new AbortController()
  const pending = policy.resolve('https://fixture.test/', { signal: controller.signal })
  controller.abort(new Error('test cancellation'))
  await assert.rejects(pending, /test cancellation/)
  const second = policy.resolve('https://fixture.test/')
  policy.close()
  await assert.rejects(second, /Network policy closed/)
  await assert.rejects(policy.resolve('https://fixture.test/'), /Network policy closed/)
})

test('a policy closed as resolution completes cannot open a HEAD connection', async t => {
  let connections = 0
  const { server, url } = await origin(t, (_req, res) => res.end())
  server.on('connection', () => { connections++ })
  const policy = new NetworkPolicy([])
  const resolve = policy.resolve.bind(policy)
  policy.resolve = async (...args) => {
    const destination = await resolve(...args)
    policy.close()
    return destination
  }
  await assert.rejects(fetchHead(url, policy), { code: 'ERR_NETWORK_POLICY' })
  assert.equal(connections, 0)
})

test('HEAD reads response headers larger than Node\'s default limit', async t => {
  const { url } = await origin(t, (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/pdf', 'content-security-policy': 'x'.repeat(20000) })
    res.end()
  })
  const result = await fetchHead(url, new NetworkPolicy([]))
  assert.equal(result.headers.get('content-type'), 'application/pdf')
})
