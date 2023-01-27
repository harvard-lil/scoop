import test from 'node:test'
import assert from 'node:assert/strict'

import AdmZip from 'adm-zip'

import { BASE_PATH } from '../constants.js'
import { WACZ } from './WACZ.js'

const exampleFixtureZip = new AdmZip(`${BASE_PATH}/fixtures/example-https.wacz`)
const exampleFixtureEntries = exampleFixtureZip.getEntries().map(entry => [entry.entryName, exampleFixtureZip.readFile(entry)])
const fixture = Object.fromEntries(exampleFixtureEntries)

test('WACZ should validate WARC files', async (_t) => {
  assert.doesNotThrow(() => {
    new WACZ({ files: {'archive/data.warc': fixture['archive/data.warc']} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'archive/data.warc': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})

test('WACZ should validate index files', async (_t) => {
  assert.doesNotThrow(() => {
    new WACZ({ files: {'indexes/index.cdx': fixture['indexes/index.cdx']} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'indexes/index.cdx': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})

test('WACZ should validate pages files', async (_t) => {
  assert.doesNotThrow(() => {
    new WACZ({ files: {'pages/pages.jsonl': fixture['pages/pages.jsonl']} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'pages/pages.jsonl': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})

test('WACZ should generate a valid index file', async (_t) => {
  const wacz = new WACZ({ files: fixture })
  const index = await wacz.generateIndexCDX()

  assert.deepEqual(index, fixture['indexes/index.cdx'])
})
