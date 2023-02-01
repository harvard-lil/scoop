import test from 'node:test'
import assert from 'node:assert/strict'

import { MischiefIntercepter } from './index.js'
import { Mischief } from '../Mischief.js'

test('MischiefIntercepter constructor "capture" argument must be a Mischief instance.', async (_t) => {
  for (const capture of [{}, [], true, 12, 'FOO', ['FOO'], () => {}]) {
    assert.throws(() => new MischiefIntercepter(capture))
  }
})

test('MischiefIntercepter setup and teardown methods throw as not implemented.', async (_t) => {
  const capture = new Mischief('https://example.com')
  const intercepter = new MischiefIntercepter(capture)
  assert.throws(() => intercepter.setup())
  assert.throws(() => intercepter.teardown())
})

/*
test('checkExchangeForNoArchive returns true when noarchive directive is present.', async (_t) => {

})
*/
