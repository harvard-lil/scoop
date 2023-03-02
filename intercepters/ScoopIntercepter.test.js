import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES_PATH } from '../constants.js'
import { ScoopIntercepter } from './index.js'
import { Scoop } from '../Scoop.js'
import { ScoopProxyExchange } from '../exchanges/ScoopProxyExchange.js'

test('ScoopIntercepter constructor "capture" argument must be a Scoop instance.', async (_t) => {
  for (const capture of [{}, [], true, 12, 'FOO', ['FOO'], () => {}]) {
    assert.throws(() => new ScoopIntercepter(capture))
  }
})

test('ScoopIntercepter setup and teardown methods throw as not implemented.', async (_t) => {
  const capture = new Scoop('https://example.com')
  const intercepter = new ScoopIntercepter(capture)
  assert.throws(() => intercepter.setup())
  assert.throws(() => intercepter.teardown())
})

test('checkExchangeForNoArchive returns true when noarchive directive is present in exchange.', async (_t) => {
  const capture = await Scoop.fromWACZ(`${FIXTURES_PATH}/noarchive.netlify.app.wacz`)
  const intercepter = new ScoopIntercepter(capture)

  // Exactly 1 ScoopProxyExchange in that capture bears the "noarchive" directive.
  let noArchiveCount = 0

  for (const exchange of capture.exchanges) {
    if (exchange instanceof ScoopProxyExchange === false) {
      continue
    }

    noArchiveCount += Number(await intercepter.checkExchangeForNoArchive(exchange))
  }

  assert.equal(noArchiveCount, 1)
})

test('checkExchangeForNoArchive returns false when noarchive directive is not present in exchange.', async (_t) => {
  const capture = await Scoop.fromWACZ(`${FIXTURES_PATH}/example.com.wacz`)
  const intercepter = new ScoopIntercepter(capture)

  let noArchiveCount = 0
  for (const exchange of capture.exchanges) {
    noArchiveCount += Number(await intercepter.checkExchangeForNoArchive(exchange))
  }

  assert.equal(noArchiveCount, 0)
})

test('checkAndEnforceSizeLimit interrupts capture when size limit is reached.', async (_t) => {
  const capture = new Scoop('https://example.com')
  const intercepter = new ScoopIntercepter(capture)

  capture.options.maxCaptureSize = 100
  capture.state = Scoop.states.CAPTURE

  // We mock Scoop.teardown to get a clear indication that it was called.
  // The original method is async but not awaited by checkAndEnforceSizeLimit().
  capture.teardown = () => {
    throw new Error('TEARDOWN')
  }

  // Size limit not reached
  assert.doesNotThrow(() => intercepter.checkAndEnforceSizeLimit(), null, 'TEARDOWN')
  assert(capture.state === Scoop.states.CAPTURE)

  // Size limit reached
  intercepter.byteLength = 1000
  assert.throws(() => intercepter.checkAndEnforceSizeLimit(), null, 'TEARDOWN')
  assert(capture.state === Scoop.states.PARTIAL)
})
