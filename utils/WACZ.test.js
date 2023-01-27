import test from 'node:test'
import assert from 'node:assert/strict'

import AdmZip from 'adm-zip'

import { BASE_PATH } from '../constants.js'
import { WACZ } from './WACZ.js'

const exampleFixtureZip = new AdmZip(`${BASE_PATH}/assets/fixtures/example.com.wacz`)
const exampleFixtureEntries = exampleFixtureZip.getEntries().map(entry => [entry.entryName, exampleFixtureZip.readFile(entry)])
const fixture = Object.freeze(Object.fromEntries(exampleFixtureEntries))

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

test('WACZ should generate a valid pages file', async (_t) => {
  const wacz = new WACZ({ files: fixture })

  const jsonLines = fixture['pages/pages.jsonl'].toString().split('\n').map(JSON.parse)
  wacz.pages = jsonLines.slice(1) // remove header which will be added automatically by WACZ.js
  const pages = wacz.generatePages()

  assert.deepEqual(pages, fixture['pages/pages.jsonl'])
})

test('WACZ should generate a valid datapackage file', async (_t) => {
  const fixtureDatapackage = JSON.parse(fixture['datapackage.json'].toString())

  const { 'datapackage.json': _, 'datapackage-digest.json': __, ...files } = fixture
  const wacz = new WACZ({
    created: fixtureDatapackage.created,
    files
  })

  const jsonLines = fixture['pages/pages.jsonl'].toString().split('\n').map(JSON.parse)
  wacz.pages = jsonLines.slice(1) // remove header which will be added automatically by WACZ.js

  const datapackage = JSON.parse(wacz.generateDatapackage())

  assert.deepEqual(datapackage, fixtureDatapackage)
})

test('WACZ should generate a valid datapackage-digest file', async (_t) => {
  const wacz = new WACZ({ files: fixture })
  const digest = await wacz.generateDatapackageDigest()
  const { signedData: _, ...fixtureDigest } = JSON.parse(fixture['datapackage-digest.json'])
  assert.deepEqual(JSON.parse(digest), fixtureDigest)
})
