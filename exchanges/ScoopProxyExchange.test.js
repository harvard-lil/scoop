import test from 'node:test'
import assert from 'node:assert/strict'

import { EventEmitter } from 'node:events'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopProxyExchange } from './ScoopProxyExchange.js'

test('ScoopProxyExchange must inherit from ScoopExchange.', async (_t) => {
  assert(ScoopProxyExchange.prototype instanceof ScoopExchange)
})

test('A parsed message body holds everything received so far.', async (_t) => {
  const exchange = new ScoopProxyExchange()
  const message = new EventEmitter()
  exchange.responseParsed = message

  assert.equal(message.body, undefined)
  message.emit('data', Buffer.from('abc'))
  assert.equal(message.body.toString(), 'abc')
  message.emit('data', Buffer.from('def'))
  message.emit('data', Buffer.from('ghi'))
  assert.equal(message.body.toString(), 'abcdefghi')
  assert.equal(message.body.toString(), 'abcdefghi')
})

test('A long-streaming body costs time linear in its size.', async (_t) => {
  // 20,000 chunks of 1 KiB: joining on every chunk copies about 200 GB.
  const exchange = new ScoopProxyExchange()
  const message = new EventEmitter()
  exchange.responseParsed = message
  const chunk = Buffer.alloc(1024, 1)

  const started = Date.now()
  for (let i = 0; i < 20000; i++) {
    message.emit('data', chunk)
  }
  assert.equal(message.body.byteLength, 20000 * 1024)
  assert(Date.now() - started < 2000)
})
