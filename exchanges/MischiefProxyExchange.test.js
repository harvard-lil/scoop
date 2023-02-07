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

    assert.equal(newExchange.url.constructor, String)
    assert.equal(newExchange.url, exchange.url)

    for (const key of ['request', 'response']) {
      const newObj = newExchange[key]
      const refObj = exchange[key]

      assert.equal(newObj.startLine.constructor, String)
      assert.equal(newObj.startLine, refObj.startLine)

      assert.deepEqual(newObj.headers, refObj.headers)

      assert.equal(newObj.body.constructor, Buffer)
      assert.deepEqual(newObj.body, refObj.body)
    }
  }
})
