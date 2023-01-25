import test from 'node:test'
import assert from 'node:assert/strict'

import AdmZip from 'adm-zip'

import { Mischief } from '../Mischief.js'
import { mischiefToWacz } from './mischiefToWacz.js'
import * as zip from '../utils/zip.js'

import { defaultTestOptions } from '../options.test.js'
import { WARCParser } from 'warcio'

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
  const wacz = Buffer.from(await mischiefToWacz(capture, true))

  assert(zip.isZip(wacz)) // Is this a ZIP?
  const unzipped = new AdmZip(wacz)

  // Zip contains datapackage.json and datapackage-digest.json, both are valid JSON files
  assert(unzipped.getEntry('datapackage.json'))
  assert(unzipped.getEntry('datapackage-digest.json'))

  assert.doesNotThrow(() => {
    const raw = unzipped.getEntry('datapackage.json').getData().toString('utf-8')
    JSON.parse(raw)
  })

  assert.doesNotThrow(() => {
    const raw = unzipped.getEntry('datapackage-digest.json').getData().toString('utf-8')
    JSON.parse(raw)
  })

  // Zip contains a valid WARC file under "archive"
  assert(unzipped.getEntry('archive/data.warc'))

  assert.doesNotThrow(() => {
    const raw = unzipped.getEntry('archive/data.warc').getData()
    new WARCParser(raw) // eslint-disable-line
  })

  // Zip contains a cdx file under "indexes"
  assert(unzipped.getEntry('indexes/index.cdx'))

  // Zip contains a pages.jsonl file under "pages"
  assert(unzipped.getEntry('pages/pages.jsonl'))
})

test('mischiefToWacz accounts for "includeRaw" option appropriately.', async (_t) => {
  const capture = await testCapture()

  for (const withRaw of [true, false]) {
    const wacz = Buffer.from(await mischiefToWacz(capture, withRaw))
    const unzipped = new AdmZip(wacz)

    // Does this zip contain a "raw" folder?
    let containsRaw = false
    for (const entry of unzipped.getEntries()) {
      if (entry.entryName.toString().startsWith('raw/')) {
        containsRaw = true
        break
      }
    }
    assert(containsRaw === withRaw)
  }
})
