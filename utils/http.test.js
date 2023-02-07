import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deflateSync,
  gzipSync,
  brotliCompressSync
} from 'node:zlib'

import {
  getHead,
  getStartLine,
  getBody,
  bodyStartIndex,
  bodyToString,
  flatArrayToHeadersObject
} from './http.js'

const Headers = globalThis.Headers // TODO: This is absurd and only here to please standard JS.

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

test('getHead returns the start line, headers, and trailing newline as a buffer', async (_t) => {
  assert.equal(getHead(properlyConfiguredResponse).constructor, Buffer)
  assert.equal(getHead(properlyConfiguredResponse).toString(), msgParts.slice(0, -1).join(CRLF) + CRLF)
  assert.equal(getHead(misconfiguredResponse).toString(), msgParts.slice(0, -1).join(LF) + LF)
})

test('getStartLine returns the start line as a buffer', async (_t) => {
  assert.equal(getStartLine(properlyConfiguredResponse).constructor, Buffer)
  assert.equal(getStartLine(properlyConfiguredResponse).toString(), msgParts[0])
  assert.equal(getStartLine(misconfiguredResponse).toString(), msgParts[0])
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

test('flatArrayToHeadersObject should throw if given anything other than an array with key value pairs.', async (_t) => {
  for (const headers of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.throws(flatArrayToHeadersObject(headers))
  }
})

test('flatArrayToHeadersObject should return a Headers object for a given linear representation of headers.', async (_t) => {
  const input = [
    'age', '76448',
    'content-encoding', 'gzip',
    'content-encoding', 'br', // Checking dedupe
    'content-type', 'text/html; charset=utf-8'
  ]

  const expectedOutput = new Headers({
    age: '76448',
    'content-encoding': 'br',
    'content-type': 'text/html; charset=utf-8'
  })

  assert.deepEqual(flatArrayToHeadersObject(input), expectedOutput)
})
