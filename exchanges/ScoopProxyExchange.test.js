import test from 'node:test'
import assert from 'node:assert/strict'

import { EventEmitter } from 'node:events'

import { ScoopExchange } from './ScoopExchange.js'
import { ScoopProxyExchange } from './ScoopProxyExchange.js'

test('ScoopProxyExchange must inherit from ScoopExchange.', async (_t) => {
  assert(ScoopProxyExchange.prototype instanceof ScoopExchange)
})

const hints = 'HTTP/1.1 103 Early Hints\r\nLink: </style.css>\r\n\r\n'
const finalHead = 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n'

function parsedResponse () {
  return Object.assign(new EventEmitter(), {
    httpVersion: '1.1',
    statusCode: 200,
    statusMessage: 'OK',
    headers: { 'content-length': '2' }
  })
}

test('final response boundaries preserve raw bytes with or without informational responses', () => {
  for (const prefix of ['', hints, hints.repeat(2), 'HTTP/1.1 100 Continue\r\n\r\n' + hints]) {
    const raw = Buffer.from(prefix + finalHead + 'OK')
    const original = Buffer.from(raw)
    const parsed = parsedResponse()
    const exchange = new ScoopProxyExchange({ responseParsed: parsed, responseRaw: raw })
    parsed.emit('data', Buffer.from('OK'))
    assert.equal(exchange.response.startLine, 'HTTP/1.1 200 OK')
    assert.equal(exchange.response.headers.get('content-length'), '2')
    assert.equal(exchange.response.headers.has('link'), false)
    assert.deepEqual(exchange.response.body, Buffer.from('OK'))
    assert.deepEqual(exchange.response.bodyCombined, Buffer.from('OK'))
    assert.strictEqual(exchange.responseRaw, raw)
    assert.deepEqual(raw, original)
  }
})

test('every split of the response headers waits for complete final headers', () => {
  const headers = Buffer.from(hints.repeat(2) + finalHead)
  for (let split = 0; split < headers.length; split++) {
    const exchange = new ScoopProxyExchange({ responseParsed: parsedResponse(), responseRaw: headers.subarray(0, split) })
    assert.ok(!exchange.response, `split ${split}`)
    exchange.responseRaw = Buffer.concat([exchange.responseRaw, headers.subarray(split), Buffer.from('OK')])
    assert.deepEqual(exchange.response.body, Buffer.from('OK'))
  }
})

test('incomplete exchanges without parsed final metadata do not fabricate a response', () => {
  for (const raw of ['', hints, hints + 'HTTP/1.1 200 OK\r\nContent-Length:']) {
    const exchange = new ScoopProxyExchange({ responseRaw: Buffer.from(raw) })
    assert.ok(!exchange.response)
    assert.deepEqual(exchange.responseRaw, Buffer.from(raw))
  }
})

test('101 ends HTTP header parsing even when the upgraded payload looks like HTTP', () => {
  const payload = Buffer.from('HTTP/1.1 200 OK\r\n\r\nopaque\x00\xff', 'latin1')
  const parsed = Object.assign(parsedResponse(), { statusCode: 101, statusMessage: 'Switching Protocols', headers: { upgrade: 'fixture' } })
  const raw = Buffer.concat([Buffer.from(hints + 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: fixture\r\n\r\n'), payload])
  const exchange = new ScoopProxyExchange({ responseParsed: parsed, responseRaw: raw })
  assert.equal(exchange.response.startLine, 'HTTP/1.1 101 Switching Protocols')
  assert.deepEqual(exchange.response.body, payload)
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
