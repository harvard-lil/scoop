import test from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { createServer } from 'node:http'
import net from 'node:net'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import detectPort from 'detect-port'

import { ScoopProxy } from './index.js'
import { Scoop } from '../Scoop.js'

import { testDefaults } from '../options.js'

const BLOCKLISTED_IP = '127.0.0.1'
const BLOCKLISTED_URL = 'http://localhost'
const NON_BLOCKLISTED_IP = '93.184.216.34'
const NON_BLOCKLISTED_URL = 'https://lil.law.harvard.edu'

test('ScoopProxy starts and stops a proxy on the requested port', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const proxyPort = testDefaults.proxyPort

  assert.equal(capture.intercepter instanceof ScoopProxy, true)

  // Check that requested port is free before starting the proxy
  assert.equal(await detectPort(proxyPort), proxyPort)

  // Start proxy and check that port is then taken
  await capture.intercepter.setup()
  assert.notEqual(await detectPort(proxyPort), proxyPort)

  // Stop proxy and check that port was freed
  await capture.intercepter.teardown()
  assert.equal(await detectPort(proxyPort), proxyPort)
})

test('contextOptions returns proxy information in a format that can be directly consumed by Playwright', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const contextOptions = capture.intercepter.contextOptions

  assert.equal(contextOptions.ignoreHTTPSErrors, true)
  assert.equal(contextOptions.proxy.server, `http://${testDefaults.proxyHost}:${testDefaults.proxyPort}`)
})

test('findMatchingBlocklistRule should return the rule that matches the provided value.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter

  const scenarios = [
    { path: BLOCKLISTED_URL, remoteAddress: BLOCKLISTED_IP, shouldBeInterrupted: true },
    { path: NON_BLOCKLISTED_URL, remoteAddress: NON_BLOCKLISTED_IP, shouldBeInterrupted: false }
  ]

  for (const scenario of scenarios) {
    const { path, remoteAddress, shouldBeInterrupted } = scenario

    assert.equal(
      !!(intercepter.findMatchingBlocklistRule(path) || intercepter.findMatchingBlocklistRule(remoteAddress)),
      shouldBeInterrupted
    )
  }
})

test('recordExchanges flag actively controls whether records are added to exchanges list.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter

  const scenarios = [
    { recordExchanges: true, expectedExchangesLength: 1 },
    { recordExchanges: false, expectedExchangesLength: 1 },
    { recordExchanges: true, expectedExchangesLength: 2 }
  ]

  for (const scenario of scenarios) {
    const { recordExchanges, expectedExchangesLength } = scenario
    intercepter.recordExchanges = recordExchanges

    intercepter.onRequest(Object.assign(new PassThrough(), { url: '' }))
    assert.equal(intercepter.exchanges.length, expectedExchangesLength)
  }
})

test('Scoop preserves allowed browser wire bytes through raw WACZ export and import', { timeout: 15000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'scoop-proxy-fidelity-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const body = '<!doctype html><html><head><link rel="icon" href="data:,"><title>Fixture</title></head><body>Raw fixture</body></html>'
  const rawResponse = Buffer.from(`HTTP/1.1 200 Original Reason\r\nContent-Type: text/html\r\nContent-Length: ${Buffer.byteLength(body)}\r\nX-Weird:   padded   \r\nX-Dupe: one\r\nX-Dupe: two\r\n\r\n${body}`)
  const received = []
  const origin = createServer((request, response) => {
    if (request.method === 'HEAD') {
      response.setHeader('Content-Type', 'text/html')
      response.end()
    } else request.socket.write(rawResponse)
  })
  origin.on('connection', socket => socket.on('data', data => received.push(Buffer.from(data))))
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const url = `http://127.0.0.1:${origin.address().port}/`
  const capture = await Scoop.capture(url, {
    ...testDefaults,
    blocklist: [],
    proxyHost: '127.0.0.1',
    proxyPort: 0,
    captureTimeout: 5000,
    loadTimeout: 1000,
    networkIdleTimeout: 2000,
    behaviorsTimeout: 100,
    screenshot: false,
    pdfSnapshot: false,
    domSnapshot: false,
    provenanceSummary: false,
    captureVideoAsAttachment: false,
    captureCertificatesAsAttachment: false,
    autoScroll: false,
    autoPlayMedia: false,
    grabSecondaryResources: false,
    runSiteSpecificBehaviors: false
  })
  assert.equal(capture.state, Scoop.states.COMPLETE)
  const exchange = capture.exchanges.find(exchange => exchange.url === url)
  assert.ok(exchange)
  assert.ok(Buffer.concat(received).includes(exchange.requestRaw))
  assert.deepEqual(exchange.responseRaw, rawResponse)
  assert.equal(exchange.response.bodyCombined.toString(), body)
  const filepath = join(directory, 'capture.wacz')
  await writeFile(filepath, Buffer.from(await capture.toWACZ(true)))
  const reconstructed = await Scoop.fromWACZ(filepath)
  const imported = reconstructed.exchanges.find(item => item.id === exchange.id)
  assert.deepEqual(imported.requestRaw, exchange.requestRaw)
  assert.deepEqual(imported.responseRaw, exchange.responseRaw)
})

test('Scoop rejects a Host authority that conflicts with the absolute target', async t => {
  let connections = 0
  const origin = net.createServer(socket => { connections++; socket.destroy() })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => origin.close())
  const capture = new Scoop('https://example.com/', {
    ...testDefaults,
    proxyHost: '127.0.0.1',
    proxyPort: 0,
    blocklist: ['/forbidden.invalid/']
  })
  await capture.intercepter.setup()
  t.after(() => capture.intercepter.teardown())
  const socket = net.connect(capture.options.proxyPort, '127.0.0.1')
  t.after(() => socket.destroy())
  socket.on('error', () => {})
  const output = once(socket, 'data')
  socket.write(`GET http://127.0.0.1:${origin.address().port}/ HTTP/1.1\r\nHost: forbidden.invalid\r\n\r\n`)
  assert.match((await output)[0].toString(), /400 Bad Request/)
  assert.equal(connections, 0)
  assert.equal(capture.provenanceInfo.blockedRequests.length, 0) // Invalid authority, not a blocklist match.
})

test('ScoopProxy captures a page whose response headers exceed Node\'s default 16 KiB limit', { timeout: 30000 }, async t => {
  // Some sites send a single Content-Security-Policy header of about 16 KB.
  const csp = `default-src 'self'${' https://example.com'.repeat(1000)}`
  assert.ok(csp.length > 16 * 1024)
  const origin = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.setHeader('Content-Security-Policy', csp)
    response.end('<!doctype html><title>Large headers</title><link rel="icon" href="data:,">')
  })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const url = `http://127.0.0.1:${origin.address().port}/`

  const capture = await Scoop.capture(url, {
    ...testDefaults,
    blocklist: [],
    proxyPort: await detectPort(0),
    screenshot: false,
    domSnapshot: false,
    pdfSnapshot: false,
    captureCertificatesAsAttachment: false,
    provenanceSummary: false,
    autoScroll: false,
    autoPlayMedia: false,
    grabSecondaryResources: false,
    runSiteSpecificBehaviors: false,
    networkIdleTimeout: 1000,
    captureTimeout: 10000
  })
  assert.equal(capture.state, Scoop.states.COMPLETE)
  const page = capture.exchanges.find(exchange => exchange.url === url)
  assert.equal(page.response.headers.get('Content-Security-Policy'), csp)
  assert.ok(Buffer.from(await capture.toWARC()).includes(csp))
})
