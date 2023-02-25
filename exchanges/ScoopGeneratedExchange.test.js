import test from 'node:test'
import assert from 'node:assert/strict'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopGeneratedExchange } from './ScoopGeneratedExchange.js'

test('ScoopGeneratedExchange must inherit from ScoopExchange.', async (_t) => {
  assert(ScoopGeneratedExchange.prototype instanceof ScoopExchange)
})

test('ScoopGeneratedExchange constructor only accepts props for pre-defined properties.', async (_t) => {
  const props = { description: 'Hello world', foo: 'bar' }
  const exchange = new ScoopGeneratedExchange(props)
  assert(exchange.description === props.description)
  assert(exchange.foo === undefined)
})
