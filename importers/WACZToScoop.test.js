import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import net from 'node:net'

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

async function archiveFixture (t, provenanceInfo, mainPageUrl = url) {
  const directory = await mkdtemp(join(tmpdir(), 'scoop-import-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const zipPath = join(directory, 'capture.wacz')
  const zip = new AdmZip()
  zip.addFile('datapackage.json', Buffer.from(JSON.stringify({
    mainPageUrl,
    mainPageDate: date,
    ...(provenanceInfo ? { extras: { provenanceInfo } } : {})
  })))
  zip.addFile(`raw/request_${date}_${exchangeId}`, requestRaw)
  zip.addFile(`raw/response_${date}_${exchangeId}`, responseRaw)
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
