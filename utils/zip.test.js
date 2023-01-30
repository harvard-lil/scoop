import test from 'node:test'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { BASE_PATH } from '../constants.js'
import * as zip from './zip.js'

const waczFixture = readFileSync(`${BASE_PATH}/assets/fixtures/example.com.wacz`)
const warcGzFixture = readFileSync(`${BASE_PATH}/assets/fixtures/example.com.warc.gz`)
const nonStoreFixture = readFileSync(`${BASE_PATH}/assets/fixtures/test.txt.zip`)

test('isZip should detect when a buffer contains zip data', async (_t) => {
  assert(zip.isZip(waczFixture))
  assert(!zip.isZip(Buffer.from([1, 2, 3])))
})

test('isGzip should detect when a buffer contains gzip data', async (_t) => {
  assert(zip.isGzip(warcGzFixture))
  assert(!zip.isGzip(waczFixture))
})

test('usesStoreCompression should detect when zip data uses store compression', async (_t) => {
  assert(zip.usesStoreCompression(waczFixture))
  assert(!zip.usesStoreCompression(nonStoreFixture))
})

test('create should create a valid zip file with store compression by default', async (_t) => {
  const buf = await zip.create({ testPath: Buffer.from([1, 2, 3]) })
  assert(zip.isZip(buf))
  assert(zip.usesStoreCompression(buf))
})
