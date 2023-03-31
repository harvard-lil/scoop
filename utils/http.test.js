import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deflateSync,
  gzipSync,
  brotliCompressSync
} from 'node:zlib'

import {
  getHead,
  getBody,
  bodyStartIndex,
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

test('getHead returns the start line, headers, and trailing newline as a buffer', async (_t) => {
  assert.equal(getHead(properlyConfiguredResponse).constructor, Buffer)
  assert.equal(getHead(properlyConfiguredResponse).toString(), msgParts.slice(0, -1).join(CRLF) + CRLF)
  assert.equal(getHead(misconfiguredResponse).toString(), msgParts.slice(0, -1).join(LF) + LF)
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
