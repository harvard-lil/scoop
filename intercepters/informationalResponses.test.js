import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { gunzipSync, gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'
import AdmZip from 'adm-zip'
import { WARCParser } from 'warcio'
import { chromium } from 'playwright'
import { Scoop } from '../Scoop.js'
import { testDefaults } from '../options.js'
import { parseRawResourceDigest } from '../exporters/rawResourceName.js'

const hints = 'HTTP/1.1 103 Early Hints\r\nLink: </style.css>; rel=preload; as=style\r\nX-Phase: early\r\n\r\n'
const final = 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nX-Phase: final\r\nConnection: close\r\n\r\nOK'
const options = {
  ...testDefaults,
  ytDlpPath: process.execPath,
  cripPath: process.execPath,
  blocklist: [],
  proxyHost: '127.0.0.1',
  proxyPort: 0,
  provenanceSummary: false
}

const browserOptions = {
  ...options,
  captureTimeout: 10000,
  networkIdleTimeout: 1000,
  screenshot: false,
  pdfSnapshot: false,
  domSnapshot: false,
  captureVideoAsAttachment: false,
  captureCertificatesAsAttachment: false,
  autoScroll: false,
  autoPlayMedia: false,
  grabSecondaryResources: false,
  runSiteSpecificBehaviors: false
}

async function captureResponse (t, raw, segmentation, incomplete = false, requestBody) {
  const origin = http.createServer(request => request.socket.end(raw))
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const url = `http://127.0.0.1:${origin.address().port}/`
  const capture = new Scoop(url, options)
  capture.startedAt = new Date()
  capture.state = Scoop.states.CAPTURE
  const warn = t.mock.method(capture.log, 'warn', () => {})
  if (segmentation) {
    // Deliberately control chunks entering Scoop, after the real Portal gate.
    // Separate origin writes cannot guarantee TCP read boundaries.
    t.mock.method(capture.intercepter, 'responseTransformer', function (_response, request) {
      const chunks = []
      return new Transform({
        transform: (chunk, _encoding, callback) => {
          if (segmentation === 'coalesced') chunks.push(chunk)
          else {
            for (const byte of chunk) this.intercept('response', Buffer.from([byte]), request)
          }
          callback(null, chunk)
        },
        flush: callback => {
          if (segmentation === 'coalesced') this.intercept('response', Buffer.concat(chunks), request)
          callback()
        }
      })
    })
  }
  await capture.intercepter.setup()
  t.after(() => capture.intercepter.teardown())
  const result = new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: capture.options.proxyPort,
      path: url,
      method: requestBody ? 'POST' : 'GET',
      headers: { host: new URL(url).host, ...(requestBody ? { 'content-length': requestBody.length } : {}) },
      agent: false
    }, response => {
      response.on('error', reject)
      response.on('end', resolve)
      response.resume()
    })
    request.on('error', reject)
    request.end(requestBody)
    t.after(() => request.destroy())
  })
  if (incomplete) await assert.rejects(result)
  else await result
  const incompleteWarnings = warn.mock.calls.filter(call => /No final response received/.test(call.arguments[0]))
  assert.equal(incompleteWarnings.length, incomplete ? 1 : 0)
  capture.exchanges = capture.intercepter.exchanges
  if (capture.state === Scoop.states.CAPTURE) capture.state = Scoop.states.COMPLETE
  assert.equal(capture.exchanges.length, 1)
  if (!incomplete) assert.deepEqual(capture.exchanges[0].responseRaw, raw)
  return capture
}

// Check WARC Content-Length independently of both the embedded HTTP length and
// warcio's HTTP decoding. A following record must begin at precisely this offset.
function responseContents (warc) {
  let offset = 0
  const responses = []
  while (offset < warc.length) {
    const end = warc.indexOf('\r\n\r\n', offset)
    assert.notEqual(end, -1)
    const head = warc.subarray(offset, end).toString()
    assert.ok(head.startsWith('WARC/1.1\r\n'))
    const length = Number(/^Content-Length: (\d+)$/im.exec(head)?.[1])
    assert.ok(Number.isSafeInteger(length))
    const content = warc.subarray(end + 4, end + 4 + length)
    assert.equal(content.length, length)
    if (/^WARC-Type: response$/im.test(head)) responses.push(content)
    offset = end + 4 + length
    assert.deepEqual(warc.subarray(offset, offset + 4), Buffer.from('\r\n\r\n'))
    offset += 4
  }
  assert.equal(offset, warc.length)
  return responses
}

async function importArchive (t, data) {
  const directory = await mkdtemp(join(tmpdir(), 'scoop-informational-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const filename = join(directory, 'capture.wacz')
  await writeFile(filename, data)
  return Scoop.fromWACZ(filename)
}

async function recoverRaw (zip, entry) {
  const digest = parseRawResourceDigest(entry.entryName)
  if (!digest) return entry.getData()
  for (const archive of zip.getEntries().filter(entry => entry.entryName.endsWith('.warc.gz'))) {
    for await (const record of new WARCParser(Readable.from(archive.getData()))) {
      if (record.warcHeader('WARC-Payload-Digest') === digest) {
        return Buffer.concat([entry.getData(), Buffer.from(await record.readFully(false))])
      }
    }
  }
  assert.fail(`Missing referenced payload ${digest}`)
}

async function checkExports (t, capture, expectedBody = Buffer.from('OK'), status = '200 OK', expectedHeaders = { 'content-length': '2', 'x-phase': 'final' }) {
  const exchange = capture.exchanges[0]
  const original = Buffer.from(exchange.responseRaw)
  // A subsequent record detects a bad enclosing length, even if the first
  // response happens to be readable in isolation.
  capture.addGeneratedExchange('file:///following.txt', new Headers({ 'content-type': 'text/plain' }), Buffer.from('next'))
  const direct = Buffer.from(await capture.toWARC())
  const contents = responseContents(direct)
  assert.equal(contents.length, 2)
  assert.ok(contents[1].subarray(contents[1].indexOf('\r\n\r\n') + 4).equals(Buffer.from('next')))
  for (const includeRaw of [false, true]) {
    await t.test(`WACZ includeRaw=${includeRaw}`, async () => {
      const data = Buffer.from(await capture.toWACZ(includeRaw))
      const zip = new AdmZip(data)
      const archive = zip.getEntries().find(entry => entry.entryName.endsWith('.warc.gz'))
      assert.ok(archive)
      assert.deepEqual(responseContents(gunzipSync(archive.getData())), contents)
      const rawEntries = zip.getEntries().filter(entry => entry.entryName.startsWith('raw/'))
      if (includeRaw) {
        const raw = rawEntries.find(entry => entry.entryName.includes(exchange.id) && entry.entryName.startsWith('raw/response_'))
        assert.ok(raw)
        assert.deepEqual(await recoverRaw(zip, raw), original)
        if (expectedBody.length) {
          assert.match(raw.entryName, /_sha256-[a-f0-9]{64}$/)
          assert.deepEqual(raw.getData(), original.subarray(0, original.length - expectedBody.length))
        }
        const imported = (await importArchive(t, data)).exchanges.find(item => item.id === exchange.id)
        assert.deepEqual(imported.responseRaw, original)
        assert.deepEqual(imported.requestRaw, exchange.requestRaw)
        if (exchange.request.body.length) {
          const requestRaw = rawEntries.find(entry => entry.entryName.startsWith('raw/request_'))
          assert.match(requestRaw.entryName, /_sha256-[a-f0-9]{64}$/)
          assert.deepEqual(await recoverRaw(zip, requestRaw), exchange.requestRaw)
        }
        assert.deepEqual(imported.response.body, expectedBody)
      } else assert.equal(rawEntries.length, 0)
    })
  }
  const end = contents[0].indexOf('\r\n\r\n')
  const head = contents[0].subarray(0, end).toString()
  const lines = head.split('\r\n')
  assert.equal(lines.shift(), `HTTP/1.1 ${status}`)
  const headers = new Headers(lines.map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]))
  for (const [name, value] of Object.entries(expectedHeaders)) assert.equal(headers.get(name), value)
  assert.doesNotMatch(head, /\r\nlink:/i)
  assert.deepEqual(contents[0].subarray(end + 4), expectedBody)
  let responses = 0
  for await (const record of new WARCParser(Readable.from(direct))) {
    if (record.warcType === 'response') {
      // readFully(false) retains both transfer framing and content encoding.
      assert.deepEqual(Buffer.from(await record.readFully(false)), responses++ === 0 ? expectedBody : Buffer.from('next'))
    }
  }
  assert.equal(responses, 2)
  assert.deepEqual(exchange.responseRaw, original)
}

for (const segmentation of ['bytes', 'coalesced']) {
  test(`real proxy captures informational and final responses in ${segmentation} chunks`, { timeout: 15000 }, async t => {
    const capture = await captureResponse(t, Buffer.from(hints.repeat(2) + final), segmentation)
    await checkExports(t, capture)
  })
}

const binary = Buffer.from('body\x00\xffHTTP/1.1 103 Early Hints\r\n\r\nstill body\r\n\r\n', 'latin1')
const chunked = Buffer.concat([Buffer.from(`${binary.length.toString(16)};fixture=yes\r\n`), binary, Buffer.from('\r\n0\r\nX-Trailer: end\r\n\r\n')])
const encoded = [
  ['gzip', gzipSync(binary)], ['deflate', deflateSync(binary)], ['br', brotliCompressSync(binary)]
]
const cases = [
  { name: 'binary payload', body: binary },
  { name: '100 Continue', body: Buffer.from('OK'), prefix: 'HTTP/1.1 100 Continue\r\n\r\n' },
  { name: '404', body: binary, status: '404 Not Found' },
  { name: '204', body: Buffer.alloc(0), status: '204 No Content', headers: {} },
  { name: 'chunk framing and trailers', body: chunked, headers: { 'transfer-encoding': 'chunked', trailer: 'X-Trailer' } },
  ...encoded.map(([encoding, body]) => ({ name: encoding, body, headers: { 'content-length': String(body.length), 'content-encoding': encoding } })),
  { name: 'chunked gzip', body: Buffer.concat([Buffer.from(`${encoded[0][1].length.toString(16)}\r\n`), encoded[0][1], Buffer.from('\r\n0\r\n\r\n')]), headers: { 'transfer-encoding': 'chunked', 'content-encoding': 'gzip' } }
]

for (const { name, body, status = '200 OK', prefix = hints, headers = { 'content-length': String(body.length) } } of cases) {
  test(`real proxy and exports preserve ${name}`, { timeout: 15000 }, async t => {
    const head = `HTTP/1.1 ${status}\r\nConnection: close\r\n${Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join('')}\r\n`
    const raw = Buffer.concat([Buffer.from(prefix + head), body])
    const capture = await captureResponse(t, raw)
    await checkExports(t, capture, body, status, headers)
    assert.deepEqual(capture.exchanges[0].response.body, body)
  })
}

for (const suffix of ['', 'HTTP/1.1 200 OK\r\nContent-Length:']) {
  test(`incomplete final response is reported without inventing an archive response (${suffix || '103 only'})`, { timeout: 15000 }, async t => {
    const capture = await captureResponse(t, Buffer.from(hints + suffix), undefined, true)
    assert.equal(capture.state, Scoop.states.COMPLETE)
    const exchange = capture.exchanges[0]
    assert.ok(!exchange.response)
    // Portal forwards only complete header blocks. Retain every byte it gave
    // Scoop; a truncated header still buffered inside Portal is not captured.
    assert.deepEqual(exchange.responseRaw, Buffer.from(hints))
    assert.equal(responseContents(Buffer.from(await capture.toWARC())).length, 0)
    const data = Buffer.from(await capture.toWACZ(true))
    const zip = new AdmZip(data)
    const raw = zip.getEntries().find(entry => entry.entryName.startsWith('raw/response_'))
    assert.deepEqual(raw.getData(), exchange.responseRaw)
    const imported = (await importArchive(t, data)).exchanges.find(item => item.id === exchange.id)
    assert.deepEqual(imported.responseRaw, exchange.responseRaw)
    assert.ok(!imported.response)
  })
}

for (const count of [0, 1, 2]) {
  test(`real proxy and exports preserve the final response after ${count} Early Hints`, { timeout: 15000 }, async t => {
    const capture = await captureResponse(t, Buffer.from(hints.repeat(count) + final))
    await checkExports(t, capture)
    const response = capture.exchanges[0].response
    assert.equal(response.startLine, 'HTTP/1.1 200 OK')
    assert.equal(response.headers.get('x-phase'), 'final')
    assert.equal(response.headers.has('link'), false)
    assert.deepEqual(response.body, Buffer.from('OK'))
  })
}

test('Chromium capture exports the final response after Early Hints', { timeout: 20000 }, async t => {
  const raw = Buffer.from(hints + final)
  const origin = http.createServer((request, response) => {
    if (request.method === 'HEAD') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end()
    } else if (new URL(request.url, 'http://fixture.invalid').pathname === '/') request.socket.end(raw)
    else { response.writeHead(404); response.end() }
  })
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  let browserVersion
  const launch = chromium.launch.bind(chromium)
  t.mock.method(chromium, 'launch', async launchOptions => {
    assert.equal(launchOptions.chromiumSandbox, true)
    const browser = await launch(launchOptions)
    browserVersion = browser.version()
    return browser
  })
  const url = `http://127.0.0.1:${origin.address().port}/`
  const capture = await Scoop.capture(url, browserOptions)
  assert.equal(capture.state, Scoop.states.COMPLETE)
  t.diagnostic(`Node ${process.version}; Chromium ${browserVersion}`)
  const exchange = capture.exchanges.find(exchange => exchange.url === url)
  assert.ok(exchange)
  assert.deepEqual(exchange.responseRaw, raw)
  assert.deepEqual(exchange.response.body, Buffer.from('OK'))
  // Export the page exchange plus a sentinel; favicon requests are incidental.
  capture.exchanges = [exchange]
  await checkExports(t, capture)
})

test('a WARC payload equal to the entire raw response cannot discard final headers', { timeout: 15000 }, async t => {
  const original = Buffer.from(hints + final)
  const capture = await captureResponse(t, original)
  capture.exchanges[0].response.body = Buffer.from('NO')
  capture.addGeneratedExchange('file:///raw-copy.bin', new Headers(), original)
  const zip = new AdmZip(Buffer.from(await capture.toWACZ(true)))
  const raw = zip.getEntries().find(entry => entry.entryName.startsWith('raw/response_'))
  assert.deepEqual(raw.getData(), original)
})

for (const prefix of ['', hints]) {
  test(`a failed secondary response leaves the page capture running (103=${!!prefix})`, { timeout: 20000 }, async t => {
    let failedRequests = 0
    const origin = http.createServer((request, response) => {
      if (new URL(request.url, 'http://fixture.invalid').pathname === '/broken.js') {
        failedRequests++
        request.socket.end(prefix)
      } else {
        response.setHeader('Content-Type', 'text/html')
        response.end('<!doctype html><link rel="icon" href="data:,"><script src="/broken.js"></script><p>Keep capturing</p>')
      }
    })
    origin.listen(0, '127.0.0.1')
    await once(origin, 'listening')
    t.after(() => { origin.closeAllConnections(); origin.close() })
    const capture = await Scoop.capture(`http://127.0.0.1:${origin.address().port}/`, {
      ...browserOptions, screenshot: true, domSnapshot: true, attachmentsBypassLimits: false
    })
    assert.ok(failedRequests > 0)
    assert.equal(capture.state, Scoop.states.COMPLETE)
    assert.ok(capture.exchanges.some(exchange => exchange.url === 'file:///screenshot.png'))
    assert.ok(capture.exchanges.some(exchange => exchange.url === 'file:///dom-snapshot.html'))
    assert.equal(capture.steps.find(step => step.name === 'Screenshot').outcome, 'completed')
    assert.ok(capture.steps.every(step => step.outcome !== 'limit'))
  })
}

test('raw request and informational response payloads both survive deduplication', { timeout: 15000 }, async t => {
  const capture = await captureResponse(t, Buffer.from(hints + final), undefined, false, binary)
  assert.deepEqual(capture.exchanges[0].request.body, binary)
  await checkExports(t, capture)
})

test('teardown suppresses incomplete-response warnings for three requests in flight', { timeout: 10000 }, async t => {
  const origin = http.createServer(request => request.socket.write(hints))
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const url = `http://127.0.0.1:${origin.address().port}/`
  const capture = new Scoop(url, options)
  const warn = t.mock.method(capture.log, 'warn', () => {})
  await capture.intercepter.setup()
  t.after(() => capture.intercepter.teardown())
  const closed = []
  for (let i = 0; i < 3; i++) {
    const request = http.request({ host: '127.0.0.1', port: capture.options.proxyPort, path: url, headers: { host: new URL(url).host }, agent: false })
    request.on('error', () => {})
    t.after(() => request.destroy())
    closed.push(new Promise(resolve => request.once('close', resolve)))
    const information = once(request, 'information')
    request.end()
    await information
  }
  assert.equal(capture.intercepter.exchanges.length, 3)
  assert.ok(capture.intercepter.exchanges.every(exchange => exchange.responseRaw.equals(Buffer.from(hints))))
  await capture.intercepter.teardown()
  await Promise.all(closed)
  assert.equal(warn.mock.callCount(), 0)
})

test('real proxy handles an OPTIONS asterisk target when the origin disconnects', { timeout: 10000 }, async t => {
  const origin = http.createServer(request => request.socket.destroy())
  origin.listen(0, '127.0.0.1')
  await once(origin, 'listening')
  t.after(() => { origin.closeAllConnections(); origin.close() })
  const capture = new Scoop(`http://127.0.0.1:${origin.address().port}/`, options)
  const warn = t.mock.method(capture.log, 'warn', () => {})
  await capture.intercepter.setup()
  t.after(() => capture.intercepter.teardown())
  await new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port: capture.options.proxyPort, method: 'OPTIONS', path: '*', headers: { host: new URL(capture.url).host }, agent: false }, response => response.resume())
    request.on('error', () => {})
    request.once('close', resolve)
    t.after(() => request.destroy())
    request.end()
  })
  assert.equal(capture.intercepter.exchanges[0].requestParsed.url, '*')
  assert.equal(warn.mock.callCount(), 0)
})
