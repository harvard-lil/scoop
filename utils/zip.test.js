import test from 'node:test'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { FIXTURES_PATH } from '../constants.js'
import * as zip from './zip.js'

const waczFixture = readFileSync(`${FIXTURES_PATH}example.com.wacz`)
const nonStoreFixture = readFileSync(`${FIXTURES_PATH}test.txt.zip`)

test('isZip should detect when a buffer contains zip data.', async (_t) => {
  assert(zip.isZip(waczFixture))
  assert(!zip.isZip(Buffer.from([1, 2, 3])))
})

test('usesStoreCompression should detect when zip data uses store compression.', async (_t) => {
  assert(zip.usesStoreCompression(waczFixture))
  assert(!zip.usesStoreCompression(nonStoreFixture))
})
