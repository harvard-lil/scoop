import test from 'node:test'
import assert from 'node:assert/strict'

import Session from 'transparent-proxy/core/Session.js'
import detectPort from 'detect-port'

import { MischiefProxy } from './index.js'
import { Mischief } from '../Mischief.js'

import { defaultTestOptions } from '../options.test.js'
import { MischiefProxyExchange } from '../exchanges/MischiefProxyExchange.js'

const BLOCKLISTED_IP = '127.0.0.1'
const BLOCKLISTED_URL = 'http://localhost'
const NON_BLOCKLISTED_IP = '93.184.216.34'
const NON_BLOCKLISTED_URL = 'https://lil.law.harvard.edu'

test('MischiefProxy starts and stops a proxy on the requested port', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)
  const proxyPort = defaultTestOptions.proxyPort

  assert.equal(capture.intercepter instanceof MischiefProxy, true)

  // Check that requested port is free before starting the proxy
  assert.equal(await detectPort(proxyPort), proxyPort)

  // Start proxy and check that port is then taken
  await capture.intercepter.setup()
  assert.notEqual(await detectPort(proxyPort), proxyPort)

  // Stop proxy and check that port was freed
  capture.intercepter.teardown()
  await new Promise(resolve => setTimeout(resolve, 1000)) // Workaround until `teardown()` can be made async
  assert.equal(await detectPort(proxyPort), proxyPort)
})

test('contextOptions returns proxy information in a format that can directly consumed by Playwright', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)
  const contextOptions = capture.intercepter.contextOptions

  assert.equal(contextOptions.ignoreHTTPSErrors, true)
  assert.equal(contextOptions.proxy.server, `http://${defaultTestOptions.proxyHost}:${defaultTestOptions.proxyPort}`)
})

test('getOrInitExchange always returns an exchange when provided valid params, and creates new exchanges as needed.', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)

  const scenarios = [
    { connectionId: 12, type: 'request', shouldBeNew: true },
    { connectionId: 12, type: 'request', shouldBeNew: false },
    { connectionId: 12, type: 'response', shouldBeNew: false },
    { connectionId: 15, type: 'request', shouldBeNew: true },
    { connectionId: 15, type: 'response', shouldBeNew: false }
  ]

  let previousExchange = null

  for (const scenario of scenarios) {
    const exchange = capture.intercepter.getOrInitExchange(scenario.connectionId, scenario.type)

    assert.equal(exchange instanceof MischiefProxyExchange, true)

    if (scenarios.shouldBeNew === false) {
      assert.strictEqual(exchange, previousExchange)
    }

    previousExchange = exchange
  }
})

test('checkRequestAgainstBlocklist should detect and interrupt blocklisted exchanges.', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const scenarios = [
    { path: BLOCKLISTED_URL, remoteAddress: BLOCKLISTED_IP, shouldBeInterrupted: true },
    { path: NON_BLOCKLISTED_URL, remoteAddress: NON_BLOCKLISTED_IP, shouldBeInterrupted: false }
  ]

  for (const scenario of scenarios) {
    const { path, remoteAddress, shouldBeInterrupted } = scenario

    const session = new Session(12)
    session._dst = { remoteAddress }
    session._src = { destroyed: false }
    session.request.path = path

    session.destroy = () => {
      session._src.destroyed = true
    }

    assert.equal(intercepter.checkRequestAgainstBlocklist(session), shouldBeInterrupted)
    assert.equal(session._src.destroyed, shouldBeInterrupted)
  }
})

test('interceptRequest returns undefined when trying to intercept a session for a blocklisted exchange.', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const session = new Session(12)
  session._dst = { remoteAddress: BLOCKLISTED_IP }
  session._src = { destroyed: false }
  session.request.path = BLOCKLISTED_URL

  session.destroy = () => {
    session._src.destroyed = true
  }

  assert.equal(intercepter.interceptRequest(Buffer.from(''), session), undefined)
})

test('recordExchanges flag actively controls whether records are added to exchanges list.', async (_t) => {
  const capture = new Mischief(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const scenarios = [
    { id: 12, recordExchanges: true, expectedExchangesLength: 1 },
    { id: 13, recordExchanges: false, expectedExchangesLength: 1 },
    { id: 14, recordExchanges: true, expectedExchangesLength: 2 }
  ]

  for (const scenario of scenarios) {
    const { id, recordExchanges, expectedExchangesLength } = scenario
    const session = new Session(id)
    session._dst = { remoteAddress: NON_BLOCKLISTED_IP }
    session._src = { destroyed: false }
    session.request.path = NON_BLOCKLISTED_URL

    const data = Buffer.from('')

    intercepter.recordExchanges = recordExchanges

    intercepter.intercept('response', data, session)
    assert.equal(intercepter.exchanges.length, expectedExchangesLength)
  }
})
