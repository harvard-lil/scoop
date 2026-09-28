import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_HTTP_HEADER_SIZE } from '../constants.js'

import {
  deflateSync,
  gzipSync,
  brotliCompressSync
} from 'node:zlib'

import {
  getBody,
  bodyStartIndex,
  responseBodyStartIndex,
  bodyToString
} from './http.js'

const CRLF = '\r\n'
const LF = '\n'

const bodyFixture = 'body'
const msgParts = [
  'HTTP/2 200',
  'header: 123',
  'other-header: 456',
  '',
  bodyFixture
]

const properlyConfiguredResponse = Buffer.from(msgParts.join(CRLF))
const misconfiguredResponse = Buffer.from(msgParts.join(LF))

test('bodyStartIndex should return the index within the buffer at which the body begins.', async (_t) => {
  assert.equal(bodyStartIndex(properlyConfiguredResponse), properlyConfiguredResponse.indexOf(bodyFixture))
  assert.equal(bodyStartIndex(misconfiguredResponse), misconfiguredResponse.indexOf(bodyFixture))
})

test('responseBodyStartIndex preserves HTTP/1.0 header boundaries', () => {
  const head = ['HTTP/1.0 200 OK', 'Content-Length: 4', '', ''].join(CRLF)
  assert.equal(responseBodyStartIndex(Buffer.from(head + bodyFixture)), Buffer.byteLength(head))
})

test('response header searches are bounded independently of payload size', t => {
  const head = Buffer.from('HTTP/1.1 103 Early Hints\r\n\r\n'.repeat(2) + 'HTTP/1.1 200 OK\r\n\r\n')
  const raw = Buffer.concat([head, Buffer.alloc(20 * 1024 * 1024, 65)])
  const indexOf = Buffer.prototype.indexOf
  t.mock.method(Buffer.prototype, 'indexOf', function (...args) {
    assert.ok(this.length <= MAX_HTTP_HEADER_SIZE + 4, 'A header search scanned the unbounded payload')
    return indexOf.apply(this, args)
  })
  assert.equal(responseBodyStartIndex(raw), head.length)
})

test('responseBodyStartIndex rejects missing or invalid final status lines', () => {
  for (const message of ['', 'HTTP/1.1 103 Early Hints\r\n\r\n', 'not HTTP\r\n\r\n', 'HTTP/1.1 099 Invalid\r\n\r\n']) {
    assert.equal(responseBodyStartIndex(Buffer.from(message)), -1)
  }
})

test('getBody returns the body as a buffer', async (_t) => {
  assert.equal(getBody(properlyConfiguredResponse).constructor, Buffer)
  assert.equal(getBody(properlyConfiguredResponse).toString(), bodyFixture)
  assert.equal(getBody(misconfiguredResponse).toString(), bodyFixture)
})

test('bodyToString should handle uncompressed bodies.', async (_t) => {
  const body = await bodyToString(bodyFixture)
  assert.equal(body, bodyFixture)
})

test('bodyToString should handle deflate encoded bodies.', async (_t) => {
  const body = await bodyToString(deflateSync(bodyFixture), 'deflate')
  assert.equal(body, bodyFixture)
})

test('bodyToString should handle gzip encoded bodies.', async (_t) => {
  const body = await bodyToString(gzipSync(bodyFixture), 'gzip')
  assert.equal(body, bodyFixture)
})

test('bodyToString should handle brotli encoded bodies.', async (_t) => {
  const body = await bodyToString(brotliCompressSync(bodyFixture), 'br')
  assert.equal(body, bodyFixture)
})

test('response boundaries accept legacy blank lines and reject oversized headers', () => {
  for (const newline of [CRLF, LF]) {
    const head = newline + ['HTTP/1.1 103 Early Hints', '', '', 'HTTP/1.1 200 OK', '', ''].join(newline)
    assert.equal(responseBodyStartIndex(Buffer.from(head + bodyFixture)), Buffer.byteLength(head))
  }
  assert.equal(responseBodyStartIndex(Buffer.from('HTTP/1.1 200 OK\r\nX-Large: ' + 'a'.repeat(MAX_HTTP_HEADER_SIZE) + '\r\n\r\n')), -1)
})
