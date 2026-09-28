import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import net from 'node:net'
import { createHash } from 'node:crypto'

import AdmZip from 'adm-zip'
import { WARCParser } from 'warcio'

import { Scoop } from '../Scoop.js'
import { defaults } from '../options.js'

test.beforeEach(t => {
  // Constructor validation requires existing helper paths; importing must never execute them.
  const { ytDlpPath, cripPath } = defaults
  defaults.ytDlpPath = process.execPath
  defaults.cripPath = process.execPath
  t.after(() => Object.assign(defaults, { ytDlpPath, cripPath }))
})

const url = 'https://example.com/'
const date = '2020-01-01T00:00:00.000Z'
const exchangeId = 'd8cb07dd-9363-4d78-b779-843dc77438cc'
const requestRaw = Buffer.from(`GET ${url} HTTP/1.1\r\nHost: example.com\r\n\r\n`)
const responseRaw = Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 7\r\nContent-Type: text/plain\r\n\r\nfixture')

async function archiveFixture (t, provenanceInfo, mainPageUrl = url, rawTimestamp = date) {
  const directory = await mkdtemp(join(tmpdir(), 'scoop-import-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const zipPath = join(directory, 'capture.wacz')
  const zip = new AdmZip()
  zip.addFile('datapackage.json', Buffer.from(JSON.stringify({
    mainPageUrl,
    mainPageDate: date,
    ...(provenanceInfo ? { extras: { provenanceInfo } } : {})
  })))
  zip.addFile(`raw/request_${rawTimestamp}_${exchangeId}`, requestRaw)
  zip.addFile(`raw/response_${rawTimestamp}_${exchangeId}`, responseRaw)
  zip.addFile('archive/data.warc', Buffer.concat([
    Buffer.from([
      'WARC/1.0',
      'WARC-Type: response',
      `WARC-Target-URI: ${url}`,
      `WARC-Date: ${date}`,
      `WARC-Record-ID: <urn:uuid:${exchangeId}>`,
      'Content-Type: application/http; msgtype=response',
      `Content-Length: ${responseRaw.length}`,
      '',
      ''
    ].join('\r\n')),
    responseRaw,
    Buffer.from('\r\n\r\n')
  ]))
  await writeFile(zipPath, zip.toBuffer())
  return zipPath
}

test('historical capture options remain metadata and cannot configure imported runtime', async t => {
  const historicalOptions = {
    ytDlpPath: '/untrusted/archive/yt-dlp',
    cripPath: '/untrusted/archive/crip',
    proxyHost: '169.254.169.254',
    proxyPort: 1234,
    blocklist: [],
    publicIpResolverEndpoint: 'http://127.0.0.1/private',
    captureTimeout: 0,
    captureVideoAsAttachment: true,
    captureCertificatesAsAttachment: true
  }
  const provenanceInfo = { options: historicalOptions, captureIp: '192.0.2.1' }
  const zipPath = await archiveFixture(t, provenanceInfo)
  // Import parsing uses in-memory HTTP streams; no real socket should be opened.
  t.mock.method(net.Socket.prototype, 'connect', () => {
    assert.fail('Archive import attempted a network connection')
  })
  const capture = await Scoop.fromWACZ(zipPath)

  assert.equal(capture.state, Scoop.states.RECONSTRUCTED)
  assert.deepEqual(capture.options, defaults)
  assert.deepEqual(capture.provenanceInfo, provenanceInfo)
  assert.notStrictEqual(capture.options, capture.provenanceInfo.options)
})

test('valid legacy raw archive can be reconstructed and reprocessed with historical metadata intact', async t => {
  const provenanceInfo = { options: { ...defaults, proxyPort: 4321 }, software: 'historical Scoop' }
  const capture = await Scoop.fromWACZ(await archiveFixture(t, provenanceInfo))

  assert.equal(capture.url, url)
  assert.equal(capture.startedAt.toISOString(), date)
  assert.equal(capture.exchanges.length, 1)
  assert.deepEqual(capture.exchanges[0].requestRaw, requestRaw)
  assert.deepEqual(capture.exchanges[0].responseRaw, responseRaw)
  assert.deepEqual(capture.provenanceInfo, provenanceInfo)
  assert.equal(capture.options.proxyPort, defaults.proxyPort)

  const records = []
  for await (const record of new WARCParser(Readable.from(Buffer.from(await capture.toWARC())))) {
    if (record.warcHeader('WARC-Type') === 'response') {
      records.push({ url: record.warcHeader('WARC-Target-URI'), body: Buffer.from(await record.readFully(false)).toString() })
    }
  }
  assert.deepEqual(records, [{ url, body: 'fixture' }])
})

test('legacy archives without provenance use default runtime options', async t => {
  const capture = await Scoop.fromWACZ(await archiveFixture(t))
  assert.equal(capture.state, Scoop.states.RECONSTRUCTED)
  assert.deepEqual(capture.options, defaults)
  assert.deepEqual(capture.exchanges[0].responseRaw, responseRaw)
})

test('historical private URLs remain importable without allowing live capture', async t => {
  const privateUrl = 'http://localhost:8080/historical'
  const provenanceInfo = { options: { blocklist: [] } }
  const zipPath = await archiveFixture(t, provenanceInfo, privateUrl)
  t.mock.method(net.Socket.prototype, 'connect', () => {
    assert.fail('Historical private URL caused a network connection')
  })
  const capture = await Scoop.fromWACZ(zipPath)

  assert.equal(capture.url, privateUrl)
  assert.equal(capture.state, Scoop.states.RECONSTRUCTED)
  assert.deepEqual(capture.options, defaults)
  assert.deepEqual(capture.provenanceInfo, provenanceInfo)
  assert.deepEqual(capture.exchanges[0].responseRaw, responseRaw)
  assert.ok((await capture.toWARC()).byteLength > 0)
  await assert.rejects(capture.capture(), /reconstructed|state|initialized/i)
})

test('raw exchanges keep their dates from 17-digit and legacy ISO resource names', async t => {
  for (const rawTimestamp of ['20200101000000000', date]) {
    const capture = await Scoop.fromWACZ(await archiveFixture(t, undefined, url, rawTimestamp))
    assert.equal(capture.exchanges[0].date.toISOString(), date, rawTimestamp)
  }
})

for (const raw of [
  '',
  'HTTP/1.1 103 Early Hints\r\nLink: </style.css>\r\n\r\n',
  'HTTP/1.1 103 Early Hints\r\n\r\nHTTP/1.1 200 OK\r\nContent-Length:',
  'HTTP/1.1 200 OK\r\nInvalid Header\r\n\r\n',
  'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nHTTP/1.1 200 OK\r\n\r\nopaque'
]) {
  test(`incomplete or invalid archived response settles and preserves raw bytes (${JSON.stringify(raw)})`, { timeout: 2000 }, async t => {
    const zipPath = await archiveFixture(t)
    const zip = new AdmZip(zipPath)
    zip.deleteFile(`raw/response_${date}_${exchangeId}`)
    zip.addFile(`raw/response_${date}_${exchangeId}`, Buffer.from(raw))
    zip.writeZip(zipPath)
    const capture = await Scoop.fromWACZ(zipPath)
    assert.deepEqual(capture.exchanges[0].responseRaw, Buffer.from(raw))
    assert.ok(!capture.exchanges[0].response)
  })
}

test('a missing WARC payload preserves available bytes and the other exchanges', async t => {
  const zipPath = await archiveFixture(t)
  const zip = new AdmZip(zipPath)
  zip.deleteFile(`raw/response_${date}_${exchangeId}`)
  zip.addFile(`raw/response_${date}_${exchangeId}_sha256-${'a'.repeat(64)}`, Buffer.from('HTTP/1.1 200 OK\r\n\r\n'))
  zip.writeZip(zipPath)
  const goodId = '16bc30f6-69ac-49df-aa19-2a015f698e09'
  zip.addFile(`raw/request_${date}_${goodId}`, requestRaw)
  zip.addFile(`raw/response_${date}_${goodId}`, responseRaw)
  zip.writeZip(zipPath)
  const capture = await Scoop.fromWACZ(zipPath)
  const incomplete = capture.exchanges.find(exchange => exchange.id === exchangeId)
  const complete = capture.exchanges.find(exchange => exchange.id === goodId)
  assert.deepEqual(incomplete.responseRaw, Buffer.from('HTTP/1.1 200 OK\r\n\r\n'))
  assert.ok(!incomplete.response)
  assert.deepEqual(complete.response.body, Buffer.from('fixture'))
  const records = []
  for await (const record of new WARCParser(Readable.from(Buffer.from(await capture.toWARC())))) {
    if (record.warcType === 'response') records.push(Buffer.from(await record.readFully(false)))
  }
  assert.deepEqual(records, [Buffer.from('fixture')])
})

for (const raw of ['', 'GET / HTTP/1.1\r\nHost:', 'invalid request\r\n\r\n']) {
  test(`incomplete archived requests settle without losing raw bytes (${JSON.stringify(raw)})`, { timeout: 2000 }, async t => {
    const zipPath = await archiveFixture(t)
    const zip = new AdmZip(zipPath)
    zip.deleteFile(`raw/request_${date}_${exchangeId}`)
    zip.addFile(`raw/request_${date}_${exchangeId}`, Buffer.from(raw))
    zip.writeZip(zipPath)
    const capture = await Scoop.fromWACZ(zipPath)
    assert.deepEqual(capture.exchanges[0].requestRaw, Buffer.from(raw))
    assert.ok(!capture.exchanges[0].request)
    assert.deepEqual(capture.exchanges[0].response.body, Buffer.from('fixture'))
  })
}

for (const separator of [':', '-']) {
  test(`raw payload references with ${separator} restore all informational and final headers`, async t => {
    const zipPath = await archiveFixture(t)
    const zip = new AdmZip(zipPath)
    const digest = createHash('sha256').update('fixture').digest('hex')
    const head = Buffer.from('HTTP/1.1 103 Early Hints\r\n\r\n' + responseRaw.toString().slice(0, -7))
    const warc = zip.readFile('archive/data.warc').toString().replace('WARC-Type: response', `WARC-Payload-Digest: sha256:${digest}\r\nWARC-Type: response`)
    zip.updateFile('archive/data.warc', Buffer.from(warc))
    zip.deleteFile(`raw/response_${date}_${exchangeId}`)
    zip.addFile(`raw/response_${date}_${exchangeId}_sha256${separator}${digest}`, head)
    zip.writeZip(zipPath)
    const capture = await Scoop.fromWACZ(zipPath)
    assert.deepEqual(capture.exchanges[0].responseRaw, Buffer.concat([head, Buffer.from('fixture')]))
    assert.deepEqual(capture.exchanges[0].response.body, Buffer.from('fixture'))
  })
}

for (const prefix of ['\r\n', '\r\n\r\n', '\r\nHTTP/1.1 103 Early Hints\r\n\r\n\r\n']) {
  test(`historical responses with leading blank lines survive import and re-export (${JSON.stringify(prefix)})`, async t => {
    const zipPath = await archiveFixture(t)
    const zip = new AdmZip(zipPath)
    const raw = Buffer.concat([Buffer.from(prefix), responseRaw])
    zip.updateFile(`raw/response_${date}_${exchangeId}`, raw)
    zip.writeZip(zipPath)
    const capture = await Scoop.fromWACZ(zipPath)
    assert.deepEqual(capture.exchanges[0].responseRaw, raw)
    assert.deepEqual(capture.exchanges[0].response?.body, Buffer.from('fixture'))
    const records = []
    for await (const record of new WARCParser(Readable.from(Buffer.from(await capture.toWARC())))) {
      if (record.warcType === 'response') records.push(Buffer.from(await record.readFully(false)))
    }
    assert.deepEqual(records, [Buffer.from('fixture')])
  })
}

for (const raw of [
  'CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n',
  'GET / HTTP/1.1\r\nHost: example.com\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'
]) {
  test(`archived tunnel and upgrade requests settle (${raw.split(' ')[0]})`, { timeout: 2000 }, async t => {
    const zipPath = await archiveFixture(t)
    const zip = new AdmZip(zipPath)
    zip.updateFile(`raw/request_${date}_${exchangeId}`, Buffer.from(raw))
    zip.writeZip(zipPath)
    t.mock.method(net.Socket.prototype, 'connect', () => assert.fail('Import opened a network connection'))
    const capture = await Scoop.fromWACZ(zipPath)
    assert.deepEqual(capture.exchanges[0].requestRaw, Buffer.from(raw))
  })
}
