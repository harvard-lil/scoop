import test from 'node:test'
import assert from 'node:assert/strict'

import detectPort from 'detect-port'

// import { FIXTURES_PATH } from '../constants.js'
import { MischiefProxy } from './index.js'
import { Mischief } from '../Mischief.js'

import { defaultTestOptions } from '../options.test.js'
import { MischiefProxyExchange } from '../exchanges/MischiefProxyExchange.js'

test('MischiefProxy starts and stops a proxy on the requested port', async (_t) => {
  const capture = new Mischief('https://example.com', defaultTestOptions)
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
  const capture = new Mischief('https://example.com', defaultTestOptions)
  const contextOptions = capture.intercepter.contextOptions

  assert.equal(contextOptions.ignoreHTTPSErrors, true)
  assert.equal(contextOptions.proxy.server, `http://${defaultTestOptions.proxyHost}:${defaultTestOptions.proxyPort}`)
})

test('getOrInitExchange always returns an exchange when provided valid params, and creates new exchanges as needed.', async (_t) => {
  const capture = new Mischief('https://example.com', defaultTestOptions)

  const scenarios = [
    { connectionId: 12, type: 'request', shouldBeNew: true },
    { connectionId: 12, type: 'request', shouldBeNew: false },
    { connectionId: 12, type: 'response', shouldBeNew: false }
  ]

  let previousExchange = null

  for (const scenario of Object.values(scenarios)) {
    const exchange = capture.intercepter.getOrInitExchange(scenario.connectionId, scenario.type)

    assert.equal(exchange instanceof MischiefProxyExchange, true)

    if (scenarios.shouldBeNew === false) {
      assert.strictEqual(exchange, previousExchange)
    }

    previousExchange = exchange
  }
})
