import test from 'node:test'
import assert from 'node:assert/strict'

import { headersArrayToMap } from './http.js'

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
