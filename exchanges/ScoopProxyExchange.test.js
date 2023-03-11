import test from 'node:test'
import assert from 'node:assert/strict'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopProxyExchange } from './ScoopProxyExchange.js'

test('ScoopProxyExchange must inherit from ScoopExchange.', async (_t) => {
  assert(ScoopProxyExchange.prototype instanceof ScoopExchange)
})
