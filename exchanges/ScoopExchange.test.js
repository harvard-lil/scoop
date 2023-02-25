import test from 'node:test'
import assert from 'node:assert/strict'

import { validate as validateUuid } from 'uuid'

import { ScoopExchange } from './ScoopExchange.js'

test('ScoopExchange constructor only accepts props for pre-defined properties.', async (_t) => {
  const exchange = new ScoopExchange({ isEntryPoint: true, foo: 'bar' })
  assert.equal(exchange.isEntryPoint, true)
  assert.equal(exchange.foo, undefined)
})

test('ScoopExchange.id should be a valid v4 UUID by default.', async (_t) => {
  const exchange = new ScoopExchange()
  assert(exchange.id)
  assert(validateUuid(exchange.id))
})

test('ScoopExchange.date should be a valid Date object by default.', async (_t) => {
  const exchange = new ScoopExchange()
  assert(exchange.date)
  assert(exchange.date.constructor === new Date().constructor)
})
