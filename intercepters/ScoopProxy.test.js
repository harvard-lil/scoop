import test from 'node:test'
import assert from 'node:assert/strict'

import Session from 'transparent-proxy/core/Session.js'
import detectPort from 'detect-port'

import { ScoopProxy } from './index.js'
import { Scoop } from '../Scoop.js'

import { testDefaults } from '../options.js'

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
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const proxyPort = testDefaults.proxyPort

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
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const contextOptions = capture.intercepter.contextOptions

  assert.equal(contextOptions.ignoreHTTPSErrors, true)
  assert.equal(contextOptions.proxy.server, `http://${testDefaults.proxyHost}:${testDefaults.proxyPort}`)
})

test('checkRequestAgainstBlocklist should detect and interrupt blocklisted exchanges.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
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
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter
  const session = mockSession(12, BLOCKLISTED_IP, BLOCKLISTED_URL)

  assert.equal(intercepter.interceptRequest(Buffer.from(''), session), undefined)
})

test('recordExchanges flag actively controls whether records are added to exchanges list.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
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
