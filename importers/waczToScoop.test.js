import test from 'node:test'
import assert from 'node:assert/strict'

import { v4 as uuidv4 } from 'uuid'
import { writeFile, rm } from 'fs/promises'

import { Scoop } from '../Scoop.js'
import { TMP_PATH } from '../constants.js'
import { valueOf } from '../utils/valueOf.js'

import { defaultTestOptions } from '../options.js'

test('waczToScoop\'s roundtrip should produce identical Scoop object.', async (_t) => {
  const fpath = `${TMP_PATH}${uuidv4()}.wacz`
  const capture = new Scoop('https://example.com', defaultTestOptions)

  await capture.capture()
  const wacz = await capture.toWacz()

  let reconstructedCapture
  try {
    await writeFile(fpath, Buffer.from(wacz))
    reconstructedCapture = await Scoop.fromWacz(fpath)
  } finally {
    await rm(fpath, { force: true })
  }

  assert.deepEqual(valueOf(reconstructedCapture), valueOf(capture))
})
