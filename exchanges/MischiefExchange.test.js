import test from 'node:test'
import assert from 'node:assert/strict'

import { validate as validateUuid } from 'uuid'

import { MischiefExchange } from './MischiefExchange.js'

test('MischiefExchange constructor only accepts props for pre-defined properties.', async (_t) => {
  const exchange = new MischiefExchange({ isEntryPoint: true, foo: 'bar' })
  assert(exchange.isEntryPoint === true)
  assert(exchange.foo === undefined)
})

test('MischiefExchange.id should be a valid v4 UUID by default.', async (_t) => {
  const exchange = new MischiefExchange()
  assert(exchange.id)
  assert(validateUuid(exchange.id))
})

test('MischiefExchange.date should be a valid Date object by default.', async (_t) => {
  const exchange = new MischiefExchange()
  assert(exchange.date)
  assert(exchange.date.constructor === new Date().constructor)
})
