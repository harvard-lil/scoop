import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deflateSync,
  gzipSync,
  brotliCompressSync
} from 'node:zlib'

import {
  bodyStartIndex,
  versionFromStatusLine,
  bodyToString,
  headersArrayToMap
} from './http.js'

const bodyFixture = 'test'

test('bodyStartIndex: should return the index within the buffer at which the body begins.', async (_t) => {
  const bodyParts = [
    'HTTP/2 200',
    'header: 123',
    '',
    'body'
  ]
  assert.equal(bodyStartIndex(bodyParts.join('\r\n')), 27) // property configured server
  assert.equal(bodyStartIndex(bodyParts.join('\n')), 24) // misconfigured server
})

test('versionFromStatusLine: should parse major and minor versions.', async (_t) => {
  assert.deepEqual(versionFromStatusLine('HTTP/1.1 200 OK'), [1, 1])
})

test('versionFromStatusLine: should handle major versions without minor notation.', async (_t) => {
  assert.deepEqual(versionFromStatusLine('HTTP/2 204 NO CONTENT'), [2])
})

test('bodyToString: should handle uncompressed bodies.', async (_t) => {
  const body = await bodyToString(bodyFixture)
  assert.equal(body, bodyFixture)
})

test('bodyToString: should handle deflate encoded bodies.', async (_t) => {
  const body = await bodyToString(deflateSync(bodyFixture), 'deflate')
  assert.equal(body, bodyFixture)
})

test('bodyToString: should handle gzip encoded bodies.', async (_t) => {
  const body = await bodyToString(gzipSync(bodyFixture), 'gzip')
  assert.equal(body, bodyFixture)
})

test('bodyToString: should handle brotli encoded bodies.', async (_t) => {
  const body = await bodyToString(brotliCompressSync(bodyFixture), 'br')
  assert.equal(body, bodyFixture)
})

test('headersArrayToMap: should return an empty object if given anything other than an array.', async (_t) => {
  for (const headers of [null, true, false, 12, 'FOO', {}, () => {}, ['foo']]) {
    assert.deepEqual(headersArrayToMap(headers), {})
  }
})

test('headersArrayToMap: returns a hashmap for a given linear representation of headers.', async (_t) => {
  const input = [
    'age', '76448',
    'content-encoding', 'gzip',
    'content-encoding', 'br', // Checking dedupe
    'content-type', 'text/html; charset=utf-8'
  ]

  const expectedOutput = {
    age: '76448',
    'content-encoding': 'br',
    'content-type': 'text/html; charset=utf-8'
  }

  assert.deepEqual(headersArrayToMap(input), expectedOutput)
})
