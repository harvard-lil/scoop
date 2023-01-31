import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES_PATH } from '../constants.js'
import { MischiefHTTPParser } from './MischiefHTTPParser.js'
import { Mischief } from '../Mischief.js'
import { MischiefProxyExchange } from '../exchanges/MischiefProxyExchange.js'

/**
 * Loads and returns the first available "complete" MischiefProxyExchange from sample WACZ.
 * Uses module-level cache.
 * @ignore
 * @returns {MischiefProxyExchange}
 */
async function getSampleMischiefProxyExchange () {
  if (_exchange instanceof MischiefProxyExchange) {
    return _exchange
  }

  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}example.com.wacz`)

  for (const exchange of capture.exchanges) {
    if (exchange instanceof MischiefProxyExchange && exchange.requestRaw && exchange.responseRaw) {
      _exchange = exchange
    }
  }

  return _exchange
}

let _exchange = null // Caching variable for getSampleMischiefProxyExchange

test('MischiefHTTPParser.parseRequest: throws if given anything else than a buffer.', async (_t) => {
  for (const input of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.throws(() => MischiefHTTPParser.parseRequest(input))
  }
})

test('MischiefHTTPParser.parseRequest: returns a hashmap out of raw HTTP request bytes.', async (_t) => {
  const exchange = await getSampleMischiefProxyExchange()
  const parsed = MischiefHTTPParser.parseRequest(exchange.requestRaw)

  assert(typeof parsed.shouldKeepAlive === 'boolean')
  assert(typeof parsed.upgrade === 'boolean')
  assert(typeof parsed.method === 'string')
  assert(typeof parsed.url === 'string')
  assert(typeof parsed.versionMajor === 'number')
  assert(typeof parsed.versionMinor === 'number')
  assert(parsed.headers.constructor.name === 'Array')
  assert(parsed.body instanceof Buffer)
  assert(parsed.trailers.constructor.name === 'Array')
})

test('MischiefHTTPParser.parseResponse: throws if given anything else than a buffer.', async (_t) => {
  for (const input of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.throws(() => MischiefHTTPParser.parseResponse(input))
  }
})

test('MischiefHTTPParser.parseResponse: returns a hashmap out of raw HTTP response bytes.', async (_t) => {
  const exchange = await getSampleMischiefProxyExchange()
  const parsed = MischiefHTTPParser.parseResponse(exchange.responseRaw)

  assert(typeof parsed.shouldKeepAlive === 'boolean')
  assert(typeof parsed.upgrade === 'boolean')
  assert(typeof parsed.statusCode === 'number')
  assert(typeof parsed.statusMessage === 'string')
  assert(typeof parsed.versionMajor === 'number')
  assert(typeof parsed.versionMinor === 'number')
  assert(parsed.headers.constructor.name === 'Array')
  assert(parsed.body instanceof Buffer)
  assert(parsed.trailers.constructor.name === 'Array')
})
