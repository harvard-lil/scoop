import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

import { WARCParser } from 'warcio'

import { mischiefToWarc, prepareExchangeStatusLine } from './mischiefToWarc.js'
import { MischiefExchange, MischiefGeneratedExchange, MischiefProxyExchange } from '../exchanges/index.js'
import { Mischief } from '../Mischief.js'
import { FIXTURES_PATH } from '../constants.js'

test('prepareExchangeStatusLine throws if not given a MischiefExchange-like object.', async (_t) => {
  for (const exchange of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.throws(() => prepareExchangeStatusLine(exchange))
  }
})

test('prepareExchangeStatusLine accepts any MischiefExchange-like object.', async (_t) => {
  for (const className of [MischiefExchange, MischiefGeneratedExchange, MischiefProxyExchange]) {
    const exchange = new className() // eslint-disable-line
    exchange.response = {}
    exchange.response.versionMajor = 1
    exchange.response.versionMinor = 1
    exchange.response.statusCode = 200
    exchange.response.statusMessage = 'OK'

    assert.doesNotThrow(() => prepareExchangeStatusLine(exchange))
  }
})

test('prepareExchangeStatusLine returns WARC-compatible HTTP status lines.', async (_t) => {
  const exchange = new MischiefExchange()
  exchange.request = {}
  exchange.request.method = 'GET'
  exchange.request.url = 'https://lil.law.harvard.edu/'
  exchange.request.versionMajor = 1
  exchange.request.versionMinor = 1
  const expectedRequestStatusLine = 'GET https://lil.law.harvard.edu/ HTTP/1.1'

  exchange.response = {}
  exchange.response.versionMajor = 1
  exchange.response.versionMinor = 1
  exchange.response.statusCode = 200
  exchange.response.statusMessage = 'OK'
  const expectedResponseStatusLine = 'HTTP/1.1 200 OK'

  assert(prepareExchangeStatusLine(exchange, 'request') === expectedRequestStatusLine)
  assert(prepareExchangeStatusLine(exchange, 'response') === expectedResponseStatusLine)
})

test('mischiefToWarc throws if given anything else than a Mischief instance.', async (_t) => {
  for (const capture of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.rejects(mischiefToWarc(capture))
  }
})

test('mischiefToWarc generates a valid WARC file.', async (_t) => {
  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}example.com.wacz`)

  let expectedRequests = 0
  let expectedResponses = 0
  let actualRequests = 0
  let actualResponses = 0
  let actualWarcInfo = 0

  // Count exchanges in Mischief capture
  for (const exchange of capture.exchanges) {
    if (exchange.request) {
      expectedRequests += 1
    }

    if (exchange.response) {
      expectedResponses += 1
    }
  }

  // Count exchanges in resulting WARC
  const raw = Buffer.from(await mischiefToWarc(capture))
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

  assert(actualWarcInfo === 1)
  assert(expectedRequests === actualRequests)
  assert(expectedResponses === actualResponses)
})
