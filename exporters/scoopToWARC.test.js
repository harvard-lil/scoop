import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable, PassThrough } from 'node:stream'
import { ScoopProxyExchange } from '../exchanges/ScoopProxyExchange.js'
import { testDefaults } from '../options.js'
import { promisify } from 'util'
import zlib from 'zlib'

import { WARCParser } from 'warcio'

import { scoopToWARC } from './scoopToWARC.js'
import { Scoop } from '../Scoop.js'
import { FIXTURES_PATH } from '../constants.js'

const gunzip = promisify(zlib.gunzip)

test('scoopToWARC throws if given anything else than a Scoop instance.', async (_t) => {
  for (const capture of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.rejects(scoopToWARC(capture))
  }
})

test('scoopToWARC generates a valid WARC file.', async (_t) => {
  const capture = await Scoop.fromWACZ(`${FIXTURES_PATH}example.com.wacz`)

  let expectedRequests = 0
  let expectedResponses = 0
  let actualRequests = 0
  let actualResponses = 0
  let actualWarcInfo = 0

  // Count exchanges in Scoop capture
  for (const exchange of capture.exchanges) {
    if (exchange.request) {
      expectedRequests += 1
    }

    if (exchange.response) {
      expectedResponses += 1
    }
  }

  // Count exchanges in resulting WARC
  const raw = Buffer.from(await scoopToWARC(capture))
  const rawStream = Readable.from(raw)

  for await (const record of WARCParser.iterRecords(rawStream)) {
    if (record.warcType === 'warcinfo') {
      actualWarcInfo += 1
    }

    if (record.warcType === 'request') {
      actualRequests += 1
    }

    if (record.warcType === 'response') {
      actualResponses += 1
    }
  }

  assert.equal(actualWarcInfo, 1)
  assert.equal(expectedRequests, actualRequests)
  assert.equal(expectedResponses, actualResponses)
})

test('scoopToWARC\'s gzip option is properly taken into account.', async (_t) => {
  const capture = await Scoop.fromWACZ(`${FIXTURES_PATH}example.com.wacz`)

  const raw = await scoopToWARC(capture, false)
  const deflated = await scoopToWARC(capture, true)

  assert.notEqual(raw, deflated)
  assert.notEqual(raw.byteLength, deflated.byteLength)

  const inflated = await gunzip(deflated) // Would throw if not valid GZIP
  assert.equal(inflated.byteLength, raw.byteLength)
})

test('parsed responses with unlocatable raw headers are reported instead of silently omitted', async t => {
  const capture = new Scoop('https://example.com/', testDefaults)
  capture.state = Scoop.states.COMPLETE
  capture.exchanges.push(new ScoopProxyExchange({
    url: capture.url,
    responseRaw: Buffer.from('invalid response\r\n\r\n'),
    responseParsed: new PassThrough()
  }))
  const warn = t.mock.method(capture.log, 'warn', () => {})
  await capture.toWARC()
  assert.equal(warn.mock.callCount(), 1)
  assert.match(warn.mock.calls[0].arguments[0], /Could not locate final response headers/)
})

for (const responseRaw of [Buffer.alloc(0), Buffer.from('invalid response\r\n\r\n')]) {
  test(`missing response diagnostics are safe, accurate and emitted once (raw=${responseRaw.length})`, async t => {
    const capture = new Scoop('https://example.com/', testDefaults)
    capture.state = Scoop.states.COMPLETE
    const requestParsed = Object.assign(new PassThrough(), { method: 'OPTIONS', url: '*', headers: {} })
    capture.exchanges.push(new ScoopProxyExchange({ requestParsed, responseParsed: new PassThrough(), responseRaw }))
    capture.addGeneratedExchange('file:///following.txt', new Headers(), Buffer.from('keep'))
    const warn = t.mock.method(capture.log, 'warn', () => {})
    for (let attempt = 0; attempt < 2; attempt++) {
      const output = await capture.toWARC()
      assert.ok(Buffer.from(output).includes('keep'))
    }
    assert.equal(warn.mock.callCount(), 1)
    assert.doesNotMatch(warn.mock.calls[0].arguments[0], /retaining raw/)
  })
}
