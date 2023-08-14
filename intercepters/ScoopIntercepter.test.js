import test from 'node:test'
import assert from 'node:assert/strict'

import { ScoopIntercepter } from './index.js'
import { Scoop } from '../Scoop.js'

test('ScoopIntercepter constructor "capture" argument must be a Scoop instance.', async (_t) => {
  for (const capture of [{}, [], true, 12, 'FOO', ['FOO'], () => {}]) {
    assert.throws(() => new ScoopIntercepter(capture))
  }
})

test('ScoopIntercepter setup and teardown methods throw as not implemented.', async (_t) => {
  const capture = new Scoop('https://example.com')
  const intercepter = new ScoopIntercepter(capture)
  assert.rejects(intercepter.setup())
  assert.rejects(intercepter.teardown())
})

test('checkAndEnforceSizeLimit interrupts capture when size limit is reached.', async (_t) => {
  const capture = new Scoop('https://example.com')
  const intercepter = new ScoopIntercepter(capture)

  capture.options.maxCaptureSize = 100
  capture.state = Scoop.states.CAPTURE

  // Size limit not reached
  intercepter.checkAndEnforceSizeLimit()
  assert.equal(capture.state, Scoop.states.CAPTURE)
  assert.equal(intercepter.recordExchanges, true)

  // Size limit reached
  intercepter.byteLength = 1000
  intercepter.checkAndEnforceSizeLimit()
  assert.equal(capture.state, Scoop.states.PARTIAL)
  assert.equal(intercepter.recordExchanges, false)
})
