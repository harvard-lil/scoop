import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'fs/promises'

import { MischiefExchange } from './MischiefExchange.js'
import { MischiefProxyExchange } from './MischiefProxyExchange.js'

import * as CONSTANTS from '../constants.js'

/**
 * Dump of a sample MischiefProxyExchange instance as JSON.
 */
const mock = await (async () => {
  const raw = await readFile(`${CONSTANTS.ASSETS_PATH}/fixtures/MischiefProxyExchange.mock.json`)
  return JSON.parse(await raw.toString('utf-8'))
})()

test('MischiefProxyExchange must inherit from MischiefExchange.', async (_t) => {
  assert(MischiefProxyExchange.prototype instanceof MischiefExchange)
})

test('MischiefProxyExchange request and response properties populate automatically from requestRaw and responseRaw.', async (_t) => {
  const requestRaw = Buffer.from(mock._requestRaw.data)
  const responseRaw = Buffer.from(mock._responseRaw.data)

  const exchanges = []
  exchanges.push(new MischiefProxyExchange({ requestRaw, responseRaw }))

  exchanges.push(new MischiefProxyExchange())
  exchanges[1].requestRaw = requestRaw
  exchanges[1].responseRaw = responseRaw

  for (const exchange of exchanges) {
    assert(exchange.requestRawBody instanceof Buffer)
    assert(exchange.requestRawHeaders instanceof Buffer)
    assert(exchange.responseRawBody instanceof Buffer)
    assert(exchange.requestRawHeaders instanceof Buffer)

    for (const key of ['request', 'response']) {
      const obj = exchange[key]
      assert(typeof obj.shouldKeepAlive === 'boolean')
      assert(typeof obj.upgrade === 'boolean')
      assert(typeof obj.versionMajor === 'number')
      assert(typeof obj.versionMinor === 'number')
      assert(obj.body instanceof Buffer)

      if (key === 'response') {
        assert(typeof obj.statusCode === 'number')
        assert(typeof obj.statusMessage === 'string')
      }
    }
  }
})
