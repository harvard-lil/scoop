import test from 'node:test'
import assert from 'node:assert/strict'

import AdmZip from 'adm-zip'

import { Mischief } from '../Mischief.js'
import { mischiefToWacz } from './mischiefToWacz.js'
import { WACZ } from '../utils/WACZ.js'
import { isZip } from '../utils/zip.js'

import { defaultTestOptions } from '../options.test.js'

/**
 * Makes a capture of https://example.com and returns the resulting Mischief object.
 * Uses module-level cache (so it only runs once for the entire test suite).
 * @ignore
 * @returns {Mischief}
 */
async function testCapture () {
  const capture = new Mischief('https://example.com', defaultTestOptions)
  await capture.capture()
  _capture = capture
  return _capture
}

let _capture = null // Caching variable for testCapture

test('mischiefToWacz throws if given anything else than a Mischief instance for "capture".', async (_t) => {
  for (const capture of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.rejects(mischiefToWacz(capture))
  }
})

test('mischiefToWacz generates a valid WACZ file.', async (_t) => {
  const capture = await testCapture()
  const waczBuffer = Buffer.from(await mischiefToWacz(capture, true))

  assert(isZip(waczBuffer)) // Is this a ZIP?
  const zip = new AdmZip(waczBuffer)

  const entries = zip.getEntries().map(entry => [entry.entryName, zip.readFile(entry)])
  assert.doesNotReject(async () => {
    const wacz = new WACZ({ files: Object.fromEntries(entries) })
    await wacz.finalize()
  })
})

test('mischiefToWacz accounts for "includeRaw" option appropriately.', async (_t) => {
  const capture = await testCapture()

  for (const withRaw of [true, false]) {
    const wacz = Buffer.from(await mischiefToWacz(capture, withRaw))
    const zip = new AdmZip(wacz)

    // Does this zip contain a "raw" folder?
    let containsRaw = false
    for (const entry of zip.getEntries()) {
      if (entry.entryName.toString().startsWith('raw/')) {
        containsRaw = true
        break
      }
    }
    assert(containsRaw === withRaw)
  }
})
