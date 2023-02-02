import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES_PATH } from '../constants.js'
import { MischiefIntercepter } from './index.js'
import { Mischief } from '../Mischief.js'
import { MischiefProxyExchange } from '../exchanges/MischiefProxyExchange.js'

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

test('checkExchangeForNoArchive returns true when noarchive directive is present in exchange.', async (_t) => {
  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}/noarchive.netlify.app.wacz`)
  const intercepter = new MischiefIntercepter(capture)

  // Exactly 1 MischiefProxyExchange in that capture bears the "noarchive" directive.
  let noArchiveCount = 0

  for (const exchange of capture.exchanges) {
    if (exchange instanceof MischiefProxyExchange === false) {
      continue
    }

    noArchiveCount += Number(await intercepter.checkExchangeForNoArchive(exchange))
  }

  assert(noArchiveCount === 1)
})

test('checkExchangeForNoArchive returns false when noarchive directive is not present in exchange.', async (_t) => {
  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}/example.com.wacz`)
  const intercepter = new MischiefIntercepter(capture)

  let noArchiveCount = 0
  for (const exchange of capture.exchanges) {
    noArchiveCount += Number(await intercepter.checkExchangeForNoArchive(exchange))
  }

  assert(noArchiveCount === 0)
})

test('checkAndEnforceSizeLimit interrupts capture when size limit is reached.', async (_t) => {
  const capture = new Mischief('https://example.com')
  const intercepter = new MischiefIntercepter(capture)

  capture.options.maxSize = 100
  capture.state = Mischief.states.CAPTURE

  // We mock Mischief.teardown to get a clear indication that it was called.
  // The original method is async but not awaited by checkAndEnforceSizeLimit().
  capture.teardown = () => {
    throw new Error('TEARDOWN')
  }

  // Size limit not reached
  assert.doesNotThrow(() => intercepter.checkAndEnforceSizeLimit(), null, 'TEARDOWN')
  assert(capture.state === Mischief.states.CAPTURE)

  // Size limit reached
  intercepter.byteLength = 1000
  assert.throws(() => intercepter.checkAndEnforceSizeLimit(), null, 'TEARDOWN')
  assert(capture.state === Mischief.states.PARTIAL)
})
