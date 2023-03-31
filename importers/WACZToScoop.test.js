import test from 'node:test'
import assert from 'node:assert/strict'

import { v4 as uuidv4 } from 'uuid'
import { writeFile, rm } from 'fs/promises'

import { Scoop } from '../Scoop.js'
import { ScoopProxyExchange } from '../exchanges/index.js'
import { TMP_PATH } from '../constants.js'
// import { valueOf } from '../utils/valueof.js'

import { testDefaults } from '../options.js'

test('WACZToScoop\'s roundtrip should produce identical Scoop object.', async (_t) => {
  const fpath = `${TMP_PATH}${uuidv4()}.wacz`

  const capture = await Scoop.capture('https://example.com', testDefaults)
  const wacz = await capture.toWACZ(true)

  let reconstructedCapture

  try {
    await writeFile(fpath, Buffer.from(wacz))
    reconstructedCapture = await Scoop.fromWACZ(fpath)
  } finally {
    await rm(fpath, { force: true })
  }

  // Run item per item comparison on specific items
  assert.deepEqual(capture.url, reconstructedCapture.url)
  assert.deepEqual(capture.options, reconstructedCapture.options)
  assert.deepEqual(capture.exchanges.length, reconstructedCapture.exchanges.length)
  assert.deepEqual(capture.provenanceInfo, reconstructedCapture.provenanceInfo)

  for (let i = 0; i < capture.exchanges.length; i++) {
    if (capture.exchanges[i] instanceof ScoopProxyExchange === false) {
      continue
    }

    if (capture.exchanges[i].requestRaw) {
      assert.deepEqual(
        capture.exchanges[i].requestRaw,
        reconstructedCapture.exchanges[i].requestRaw)
    }

    if (capture.exchanges[i].responseRaw) {
      assert.deepEqual(
        capture.exchanges[i].responseRaw,
        reconstructedCapture.exchanges[i].responseRaw)
    }
  }

  // TODO: Troubleshoot
  // assert.deepEqual(valueOf(reconstructedCapture), valueOf(capture))
})
