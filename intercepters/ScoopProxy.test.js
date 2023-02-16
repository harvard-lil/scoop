import test from 'node:test'
import assert from 'node:assert/strict'

import Session from 'transparent-proxy/core/Session.js'
import detectPort from 'detect-port'

import { ScoopProxy } from './index.js'
import { Scoop } from '../Scoop.js'

import { defaultTestOptions } from '../options.js'
import { ScoopProxyExchange } from '../exchanges/ScoopProxyExchange.js'

const BLOCKLISTED_IP = '127.0.0.1'
const BLOCKLISTED_URL = 'http://localhost'
const NON_BLOCKLISTED_IP = '93.184.216.34'
const NON_BLOCKLISTED_URL = 'https://lil.law.harvard.edu'

/**
 * Creates a mock transparent-proxy Session object.
 * @param {number} id
 * @param {string} ip
 * @param {string} url
 * @returns {Session}
 * @ignore
 */
function mockSession (id, ip, url) {
  const session = new Session(id)
  session._dst = { remoteAddress: ip }
  session._src = { destroyed: false }
  session.request.path = url

  session.destroy = () => {
    session._src.destroyed = true
  }

  return session
}

test('ScoopProxy starts and stops a proxy on the requested port', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const proxyPort = defaultTestOptions.proxyPort

  assert.equal(capture.intercepter instanceof ScoopProxy, true)

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

test('contextOptions returns proxy information in a format that can be directly consumed by Playwright', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const contextOptions = capture.intercepter.contextOptions

  assert.equal(contextOptions.ignoreHTTPSErrors, true)
  assert.equal(contextOptions.proxy.server, `http://${defaultTestOptions.proxyHost}:${defaultTestOptions.proxyPort}`)
})

test('getOrInitExchange always returns an exchange when provided valid params, and creates new exchanges as needed.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)

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

    assert.equal(exchange instanceof ScoopProxyExchange, true)

    if (scenarios.shouldBeNew === false) {
      assert.strictEqual(exchange, previousExchange)
    }

    previousExchange = exchange
  }
})

test('checkRequestAgainstBlocklist should detect and interrupt blocklisted exchanges.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const scenarios = [
    { path: BLOCKLISTED_URL, remoteAddress: BLOCKLISTED_IP, shouldBeInterrupted: true },
    { path: NON_BLOCKLISTED_URL, remoteAddress: NON_BLOCKLISTED_IP, shouldBeInterrupted: false }
  ]

  for (const scenario of scenarios) {
    const { path, remoteAddress, shouldBeInterrupted } = scenario
    const session = mockSession(12, remoteAddress, path)

    assert.equal(intercepter.checkRequestAgainstBlocklist(session), shouldBeInterrupted)
    assert.equal(session._src.destroyed, shouldBeInterrupted)
  }
})

test('interceptRequest returns undefined when trying to intercept a session for a blocklisted exchange.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter
  const session = mockSession(12, BLOCKLISTED_IP, BLOCKLISTED_URL)

  assert.equal(intercepter.interceptRequest(Buffer.from(''), session), undefined)
})

test('recordExchanges flag actively controls whether records are added to exchanges list.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const scenarios = [
    { id: 12, recordExchanges: true, expectedExchangesLength: 1 },
    { id: 13, recordExchanges: false, expectedExchangesLength: 1 },
    { id: 14, recordExchanges: true, expectedExchangesLength: 2 }
  ]

  for (const scenario of scenarios) {
    const { id, recordExchanges, expectedExchangesLength } = scenario
    const session = mockSession(id, NON_BLOCKLISTED_IP, NON_BLOCKLISTED_URL)

    const data = Buffer.from('')

    intercepter.recordExchanges = recordExchanges

    intercepter.intercept('response', data, session)
    assert.equal(intercepter.exchanges.length, expectedExchangesLength)
  }
})

test('intercept coalesces arbitrary buffers together for a given exchange, new request on full exchange creates new exchange.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, defaultTestOptions)
  const intercepter = capture.intercepter

  const testString1 = 'LOREMIPSUM'
  const testString2 = 'FOOBARBAZ'
  const expectedByteLength = Buffer.from(testString1 + testString2).byteLength

  const scenarios = [
    { id: 12, type: 'request', data: Buffer.from(testString1) },
    { id: 12, type: 'response', data: Buffer.from(testString2.substring(0, 3)) },
    { id: 12, type: 'response', data: Buffer.from(testString2.substring(3, 6)) },
    { id: 12, type: 'response', data: Buffer.from(testString2.substring(6, 9)) }
  ]

  for (const scenario of scenarios) {
    const { id, type, data } = scenario
    const session = mockSession(id, NON_BLOCKLISTED_IP, NON_BLOCKLISTED_URL)
    intercepter.intercept(type, data, session)
  }

  assert.equal(intercepter.byteLength, expectedByteLength)
  assert.equal(intercepter.exchanges[0].requestRaw.toString(), testString1)
  assert.equal(intercepter.exchanges[0].responseRaw.toString(), testString2)

  // New request on existing session for which we already have a response should create a new exchange
  const session = mockSession(scenarios[0].id, NON_BLOCKLISTED_IP, NON_BLOCKLISTED_URL)
  intercepter.intercept(scenarios[0].type, scenarios[0].data, session)

  assert.equal(intercepter.exchanges[1].requestRaw.toString(), testString1)
})
