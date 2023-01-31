import test from 'node:test'
import assert from 'node:assert/strict'

import { MischiefExchange } from './MischiefExchange.js'
import { MischiefProxyExchange } from './MischiefProxyExchange.js'
import { Mischief } from '../Mischief.js'
import { FIXTURES_PATH } from '../constants.js'

test('MischiefProxyExchange must inherit from MischiefExchange.', async (_t) => {
  assert(MischiefProxyExchange.prototype instanceof MischiefExchange)
})

test('MischiefProxyExchange request and response properties populate automatically from requestRaw and responseRaw.', async (_t) => {
  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}example.com.wacz`)

  for (const exchange of capture.exchanges) {
    if (exchange instanceof MischiefProxyExchange === false) {
      continue
    }

    // Re-create a MischiefProxyExchange from requestRaw / responseRaw
    const newExchange = new MischiefProxyExchange()
    newExchange.requestRaw = exchange.requestRaw
    newExchange.responseRaw = exchange.responseRaw

    assert(newExchange.requestRawBody instanceof Buffer)
    assert(newExchange.requestRawHeaders instanceof Buffer)
    assert(newExchange.responseRawBody instanceof Buffer)
    assert(newExchange.requestRawHeaders instanceof Buffer)

    for (const key of ['request', 'response']) {
      const newObj = newExchange[key]
      const refObj = exchange[key]

      assert(typeof newObj.shouldKeepAlive === 'boolean')
      assert(newObj.shouldKeepAlive === refObj.shouldKeepAlive)

      assert(typeof newObj.upgrade === 'boolean')
      assert(newObj.upgrade === refObj.upgrade)

      assert(typeof newObj.versionMajor === 'number')
      assert(newObj.versionMajor === refObj.versionMajor)

      assert(typeof newObj.versionMinor === 'number')
      assert(newObj.versionMinor === refObj.versionMinor)

      assert.deepEqual(newObj.headers, refObj.headers)

      assert(newObj.body instanceof Buffer)
      assert.deepEqual(newObj.body, refObj.body)

      assert(typeof newObj.url === 'string')
      assert(newObj.url === refObj.url)

      if (key === 'response') {
        assert(typeof newObj.statusCode === 'number')
        assert(newObj.statusCode === refObj.statusCode)

        assert(typeof newObj.statusMessage === 'string')
        assert(newObj.statusMessage === refObj.statusMessage)
      }
    }
  }
})
