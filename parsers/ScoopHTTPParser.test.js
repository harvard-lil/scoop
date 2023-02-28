import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES_PATH } from '../constants.js'
import { ScoopHTTPParser } from './ScoopHTTPParser.js'
import { Scoop } from '../Scoop.js'
import { ScoopProxyExchange } from '../exchanges/ScoopProxyExchange.js'

/**
 * Loads and returns the first available "complete" ScoopProxyExchange from sample WACZ.
 * Uses module-level cache.
 * @ignore
 * @returns {ScoopProxyExchange}
 */
async function getSampleScoopProxyExchange () {
  if (_exchange instanceof ScoopProxyExchange) {
    return _exchange
  }

  const capture = await Scoop.fromWACZ(`${FIXTURES_PATH}example.com.wacz`)

  for (const exchange of capture.exchanges) {
    if (exchange instanceof ScoopProxyExchange && exchange.requestRaw && exchange.responseRaw) {
      _exchange = exchange
    }
  }

  return _exchange
}

let _exchange = null // Caching variable for getSampleScoopProxyExchange

test('parseRequest throws if given anything else than a buffer.', async (_t) => {
  for (const input of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.throws(() => ScoopHTTPParser.parseRequest(input))
  }
})

test('parseRequest returns a hashmap out of raw HTTP request bytes.', async (_t) => {
  const exchange = await getSampleScoopProxyExchange()
  const parsed = ScoopHTTPParser.parseRequest(exchange.requestRaw)

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

test('parseResponse throws if given anything else than a buffer.', async (_t) => {
  for (const input of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.throws(() => ScoopHTTPParser.parseResponse(input))
  }
})

test('parseResponse returns a hashmap out of raw HTTP response bytes.', async (_t) => {
  const exchange = await getSampleScoopProxyExchange()
  const parsed = ScoopHTTPParser.parseResponse(exchange.responseRaw)

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
