import test from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'

import detectPort from 'detect-port'

import { ScoopProxy } from './index.js'
import { Scoop } from '../Scoop.js'

import { testDefaults } from '../options.js'

const BLOCKLISTED_IP = '127.0.0.1'
const BLOCKLISTED_URL = 'http://localhost'
const NON_BLOCKLISTED_IP = '93.184.216.34'
const NON_BLOCKLISTED_URL = 'https://lil.law.harvard.edu'

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

test('foundInBlocklist should detect and interrupt blocklisted exchanges.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter

  const scenarios = [
    { path: BLOCKLISTED_URL, remoteAddress: BLOCKLISTED_IP, shouldBeInterrupted: true },
    { path: NON_BLOCKLISTED_URL, remoteAddress: NON_BLOCKLISTED_IP, shouldBeInterrupted: false }
  ]

  for (const scenario of scenarios) {
    const { path, remoteAddress, shouldBeInterrupted } = scenario
    const request = { socket: new PassThrough() }

    assert(!request.socket.destroyed)
    assert.equal(
      intercepter.foundInBlocklist(path, request) || intercepter.foundInBlocklist(remoteAddress, request),
      shouldBeInterrupted
    )
    assert.equal(request.socket.destroyed, shouldBeInterrupted)
  }
})

test('intercept returns undefined when no matching exchange with provided request is not found due to blocklisting.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter

  assert.equal(intercepter.intercept('request', Buffer.from(''), {}), undefined)
})

test('recordExchanges flag actively controls whether records are added to exchanges list.', async (_t) => {
  const capture = new Scoop(NON_BLOCKLISTED_URL, testDefaults)
  const intercepter = capture.intercepter

  const scenarios = [
    { recordExchanges: true, expectedExchangesLength: 1 },
    { recordExchanges: false, expectedExchangesLength: 1 },
    { recordExchanges: true, expectedExchangesLength: 2 }
  ]

  for (const scenario of scenarios) {
    const { recordExchanges, expectedExchangesLength } = scenario
    intercepter.recordExchanges = recordExchanges

    intercepter.onRequest(Object.assign(new PassThrough(), { url: '' }))
    assert.equal(intercepter.exchanges.length, expectedExchangesLength)
  }
})
