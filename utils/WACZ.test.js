import test from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'fs/promises'
import AdmZip from 'adm-zip'

import { BASE_PATH } from '../constants.js'
import { WACZ } from './WACZ.js'

const warc = await readFile(`${BASE_PATH}/fixtures/example-https.warc`)
const wacz = new AdmZip(`${BASE_PATH}/fixtures/example-https.wacz`)

test('WACZ should validate WARC files', async (_t) => {
  assert.doesNotThrow(() => {
    new WACZ({ files: {'archives/archive.warc': warc} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'archives/archive.warc': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})

test('WACZ should validate index files', async (_t) => {
  const file = wacz.readFile(wacz.getEntry('indexes/index.cdx'))

  assert.doesNotThrow(() => {
    new WACZ({ files: {'indexes/index.cdx': file} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'indexes/index.cdx': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})

test('WACZ should validate pages files', async (_t) => {
  const file = wacz.readFile(wacz.getEntry('pages/pages.jsonl'))

  assert.doesNotThrow(() => {
    new WACZ({ files: {'pages/pages.jsonl': file} }) // eslint-disable-line
  })

  assert.throws(() => {
    new WACZ({ files: {'pages/pages.jsonl': Buffer.from([1, 2, 3])} }) // eslint-disable-line
  })
})
