import test from 'node:test'
import assert from 'node:assert/strict'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopProxyExchange } from './ScoopProxyExchange.js'
import { Scoop } from '../Scoop.js'
import { FIXTURES_PATH } from '../constants.js'

test('ScoopProxyExchange must inherit from ScoopExchange.', async (_t) => {
  assert(ScoopProxyExchange.prototype instanceof ScoopExchange)
})

test('ScoopProxyExchange request and response properties populate automatically from requestRaw and responseRaw.', async (_t) => {
  const capture = await Scoop.fromWacz(`${FIXTURES_PATH}example.com.wacz`)

  for (const exchange of capture.exchanges) {
    if (exchange instanceof ScoopProxyExchange === false) {
      continue
    }

    // Re-create a ScoopProxyExchange from requestRaw / responseRaw
    const newExchange = new ScoopProxyExchange()
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
