import test from 'node:test'
import assert from 'node:assert/strict'

import { MischiefExchange } from './MischiefExchange.js'
import { MischiefGeneratedExchange } from './MischiefGeneratedExchange.js'

test('MischiefGeneratedExchange must inherit from MischiefExchange.', async (_t) => {
  assert(MischiefGeneratedExchange.prototype instanceof MischiefExchange)
})

test('MischiefGeneratedExchange constructor only accepts props for pre-defined properties.', async (_t) => {
  const props = { description: 'Hello world', foo: 'bar' }
  const exchange = new MischiefGeneratedExchange(props)
  assert(exchange.description === props.description)
  assert(exchange.foo === undefined)
})
