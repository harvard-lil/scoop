import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { chromium } from 'playwright'
import { Scoop } from './Scoop.js'

test('a stalled PDF preserves the DOM and captured exchanges as a partial capture', { timeout: 25000 }, async t => {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><title>PDF timeout fixture</title><link rel="icon" href="data:,"><p>Preserve this content</p>')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const launch = chromium.launch.bind(chromium)
  let browser
  t.mock.method(chromium, 'launch', async options => {
    browser = await launch(options)
    const newContext = browser.newContext.bind(browser)
    t.mock.method(browser, 'newContext', async options => {
      const context = await newContext(options)
      context.on('page', page => t.mock.method(page, 'pdf', () => new Promise(() => {})))
      return context
    })
    return browser
  })
  const capture = await Scoop.capture(`http://127.0.0.1:${server.address().port}/`, {
    logLevel: 'error',
    headless: true,
    chromiumSandbox: true,
    blocklist: [],
    screenshot: false,
    domSnapshot: true,
    pdfSnapshot: true,
    captureVideoAsAttachment: false,
    captureCertificatesAsAttachment: false,
    provenanceSummary: false,
    autoScroll: false,
    autoPlayMedia: false,
    grabSecondaryResources: false,
    runSiteSpecificBehaviors: false,
    captureTimeout: 2000,
    loadTimeout: 1000,
    networkIdleTimeout: 1000,
    attachmentsBypassLimits: true,
    proxyPort: 0
  })
  assert.equal(capture.state, Scoop.states.PARTIAL)
  assert.equal(browser.isConnected(), false)
  assert.ok(capture.exchanges.some(exchange => exchange.url === 'file:///dom-snapshot.html'))
  assert.ok(capture.exchanges.some(exchange => exchange.url.startsWith('http://127.0.0.1:')))
  assert.ok(!capture.exchanges.some(exchange => exchange.url === 'file:///pdf-snapshot.pdf'))
})
