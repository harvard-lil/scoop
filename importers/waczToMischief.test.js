import test from 'node:test'
import assert from 'node:assert/strict'

import { v4 as uuidv4 } from 'uuid'
import { writeFile, rm } from 'fs/promises'

import { Mischief } from '../Mischief.js'
import * as CONSTANTS from '../constants.js'
import { valueOf } from '../utils/valueof.js'

import { defaultTestOptions } from '../options.test.js'

test('waczToMischief\'s roundtrip should produce identical Mischief object.', async (_t) => {
  const fpath = `${CONSTANTS.TMP_PATH}${uuidv4()}.wacz`
  const capture = new Mischief('https://example.com', defaultTestOptions)

  await capture.capture()
  const wacz = await capture.toWacz()

  let reconstructedCapture
  try {
    await writeFile(fpath, Buffer.from(wacz))
    reconstructedCapture = await Mischief.fromWacz(fpath)
  } finally {
    await rm(fpath, { force: true })
  }

  assert.deepEqual(valueOf(reconstructedCapture), valueOf(capture))
})
