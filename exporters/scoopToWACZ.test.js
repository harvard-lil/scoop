import test from 'node:test'
import assert from 'node:assert/strict'

import AdmZip from 'adm-zip'
import * as dotenv from 'dotenv'

import { Scoop } from '../Scoop.js'
import { scoopToWACZ } from './scoopToWACZ.js'
import { isZip, usesStoreCompression } from '../utils/zip.js'

import { testDefaults } from '../options.js'

// Loads env vars from .env if provided
dotenv.config()

/**
 * Makes a capture of https://example.com and returns the resulting Scoop object.
 * Uses module-level cache (so it only runs once for the entire test suite).
 * @ignore
 * @returns {Scoop}
 */
async function testCapture () {
  const capture = await Scoop.capture('https://example.com', testDefaults)
  _capture = capture
  return _capture
}

let _capture = null // Caching variable for testCapture

test('scoopToWACZ throws if given anything else than a Scoop instance for "capture".', async (_t) => {
  for (const capture of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.rejects(scoopToWACZ(capture))
  }
})

test('scoopToWACZ generates a valid WACZ file.', async (_t) => {
  const capture = await testCapture()
  const waczBuffer = Buffer.from(await scoopToWACZ(capture, true))
  assert(isZip(waczBuffer)) // Is this a ZIP?
  assert(usesStoreCompression(waczBuffer)) // Uses store compression?
})

test('scoopToWACZ accounts for "includeRaw" option appropriately.', async (_t) => {
  const capture = await testCapture()

  for (const withRaw of [true, false]) {
    const wacz = Buffer.from(await scoopToWACZ(capture, withRaw))
    const zip = new AdmZip(wacz)

    // Does this zip contain a "raw" folder?
    let containsRaw = false
    for (const entry of zip.getEntries()) {
      if (entry.entryName.toString().startsWith('raw/')) {
        containsRaw = true
        break
      }
    }
    assert.equal(containsRaw, withRaw)
  }
})

test('scoopToWACZ accounts for "signingServer" option appropriately.', async (t) => {
  // This test only runs if credentials to a signing server are provided.
  if (!process.env?.TEST_WACZ_SIGNING_URL) {
    t.skip('No TEST_WACZ_SIGNING_URL env var present.')
    return
  }

  const capture = await testCapture()

  const signingServer = {
    url: process.env.TEST_WACZ_SIGNING_URL
  }

  if (process.env.TEST_WACZ_SIGNING_TOKEN) {
    signingServer.token = process.env.TEST_WACZ_SIGNING_TOKEN
  }

  // Load "datapackage-digest.json" to check that it contains a signature.
  for (const signing of [signingServer, null]) {
    const wacz = Buffer.from(await scoopToWACZ(capture, false, signing))
    const zip = new AdmZip(wacz)
    const datapackageDigest = zip.getEntry('datapackage-digest.json').getData().toString()

    assert.equal('signedData' in JSON.parse(datapackageDigest), !!signing)
  }
})
