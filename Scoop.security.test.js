import test from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import http from 'node:http'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import detectPort from 'detect-port'
import nunjucks from 'nunjucks'
import { chromium } from 'playwright'
import { Scoop } from './Scoop.js'
import { TEMPLATES_PATH } from './constants.js'
import { exec } from './utils/exec.js'

const options = {
  logLevel: 'silent',
  // This test does not execute the certificate helper.
  cripPath: process.execPath,
  screenshot: false,
  domSnapshot: false,
  pdfSnapshot: false,
  captureVideoAsAttachment: false,
  captureCertificatesAsAttachment: false,
  provenanceSummary: false,
  autoScroll: false,
  autoPlayMedia: false,
  grabSecondaryResources: false,
  runSiteSpecificBehaviors: false
}

test('reconstructed captures cannot execute another capture', async () => {
  const capture = new Scoop('https://example.com/', options)
  capture.state = Scoop.states.RECONSTRUCTED
  capture.setup = () => assert.fail('An archive must not start capture setup')
  await assert.rejects(capture.capture(), /cannot be recaptured/)
})

test('a capture setup failure removes its owned private scratch directory', async () => {
  const capture = new Scoop('https://example.com/', options)
  capture.intercepter.setup = async () => { throw new Error('fixture setup failure') }
  await capture.capture()
  assert.equal(capture.state, Scoop.states.FAILED)
  assert.ok(capture.captureTmpFolderPath)
  await assert.rejects(access(capture.captureTmpFolderPath), { code: 'ENOENT' })
})

test('a default sandbox launch failure does not retry Chromium with weaker settings', async t => {
  const launch = t.mock.method(chromium, 'launch', async () => { throw new Error('Fixture sandbox unavailable') })
  const capture = new Scoop('https://example.invalid/', { ...options, proxyPort: 0 })
  t.after(() => capture.intercepter.teardown())
  await capture.capture()
  assert.equal(capture.state, Scoop.states.FAILED)
  assert.ok(capture.options.proxyPort > 0)
  assert.equal(await detectPort(capture.options.proxyPort), capture.options.proxyPort)
  assert.equal(launch.mock.callCount(), 1)
  assert.equal(launch.mock.calls[0].arguments[0].chromiumSandbox, true)
  await assert.rejects(access(capture.captureTmpFolderPath), { code: 'ENOENT' })
})

test('the CLI forwards true, false and the default sandbox choice as booleans', async () => {
  // Intercept only the capture boundary in a real CLI process; no browser,
  // network request or archive export is needed to exercise option parsing.
  const preload = `
    import { Scoop } from ${JSON.stringify(new URL('./Scoop.js', import.meta.url).href)}
    Scoop.capture = async (url, options) => {
      console.log(JSON.stringify(new Scoop(url, options).options.chromiumSandbox))
      process.exit(0)
    }
  `
  const environment = { ...process.env }
  delete environment.PWD
  for (const [args, expected] of [[[], true], [['--chromium-sandbox', 'true'], true], [['--chromium-sandbox', 'false'], false]]) {
    const stdout = await exec(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
      fileURLToPath(new URL('./bin/cli.js', import.meta.url)),
      'https://example.invalid/', '--log-level', 'silent', ...args
    ], { timeout: 5000, env: environment })
    assert.equal(JSON.parse(stdout), expected)
  }
})

test('a default Scoop capture launches Chromium without --no-sandbox', { timeout: 15000 }, async t => {
  const origin = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><title>Sandbox fixture</title><link rel="icon" href="data:,">')
  })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const originalLaunch = chromium.launch.bind(chromium)
  let browserArguments
  t.mock.method(chromium, 'launch', async launchOptions => {
    // This fixture enables CDP command-line inspection without overriding
    // the sandbox option supplied by Scoop.
    const browser = await originalLaunch({ ...launchOptions, args: ['--enable-automation'] })
    t.after(() => browser.close())
    const session = await browser.newBrowserCDPSession()
    browserArguments = (await session.send('Browser.getBrowserCommandLine')).arguments
    await session.detach()
    return browser
  })
  const capture = new Scoop(`http://127.0.0.1:${origin.address().port}/`, {
    ...options, blocklist: [], proxyPort: 0, networkIdleTimeout: 2000, captureTimeout: 10000
  })
  t.after(async () => { if (capture.state === Scoop.states.FAILED) await capture.intercepter.teardown() })
  await capture.capture()
  assert.equal(capture.state, Scoop.states.COMPLETE)
  assert.ok(browserArguments.length > 0)
  assert.equal(browserArguments.includes('--no-sandbox'), false)
  assert.equal(browserArguments.includes('--disable-setuid-sandbox'), false)
})

test('video metadata is escaped text instead of inline script source', () => {
  nunjucks.configure(TEMPLATES_PATH)
  const html = nunjucks.render('video-extracted-summary.njk', {
    metadataSaved: true,
    metadataParsed: [{ title: '<script>fixture</script>', timestamp: 'review();', publicationTime: '<script>fixture</script>' }]
  })
  assert.ok(html.includes('&lt;script&gt;fixture&lt;/script&gt;'))
  assert.ok(!html.includes('review();'))
  assert.ok(!html.includes('<script>'))
})

test('page favicon shell syntax is captured literally through the proxy with NO_PROXY=*', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'scoop-favicon-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const marker = join(directory, 'shell-must-not-run')
  const query = '$(touch${IFS}' + marker + ')' // eslint-disable-line no-template-curly-in-string
  const favicon = Buffer.from('fixture favicon')
  const origin = http.createServer((request, response) => {
    const icon = new URL(request.url, 'http://fixture.invalid').pathname.startsWith('/icon')
    const body = icon ? favicon : Buffer.from(`<html><link rel="icon" href="/icon?q=${query}"></html>`)
    response.writeHead(200, { 'Content-Type': icon ? 'image/x-icon' : 'text/html', 'Content-Length': body.length })
    response.end(body)
  })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const previousNoProxy = process.env.NO_PROXY
  process.env.NO_PROXY = '*'
  t.after(() => {
    if (previousNoProxy === undefined) delete process.env.NO_PROXY
    else process.env.NO_PROXY = previousNoProxy
  })
  const capture = await Scoop.capture(`http://127.0.0.1:${origin.address().port}/`, {
    ...options, blocklist: [], proxyPort: await detectPort(0), networkIdleTimeout: 1000, captureTimeout: 10000
  })
  assert.equal(capture.state, Scoop.states.COMPLETE)
  assert.deepEqual(capture.pageInfo.favicon, favicon)
  assert.ok(capture.exchanges.some(exchange => exchange.url === capture.pageInfo.faviconUrl))
  await assert.rejects(access(marker), { code: 'ENOENT' })
})
