import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

import { WARCParser } from 'warcio'

import { mischiefToWarc } from './mischiefToWarc.js'
import { Mischief } from '../Mischief.js'
import { FIXTURES_PATH } from '../constants.js'

test('mischiefToWarc throws if given anything else than a Mischief instance.', async (_t) => {
  for (const capture of [{}, true, false, null, () => {}, [], 'FOO']) {
    assert.rejects(mischiefToWarc(capture))
  }
})

test('mischiefToWarc generates a valid WARC file.', async (_t) => {
  const capture = await Mischief.fromWacz(`${FIXTURES_PATH}example.com.wacz`)

  let expectedRequests = 0
  let expectedResponses = 0
  let actualRequests = 0
  let actualResponses = 0
  let actualWarcInfo = 0

  // Count exchanges in Mischief capture
  for (const exchange of capture.exchanges) {
    if (exchange.request) {
      expectedRequests += 1
    }

    if (exchange.response) {
      expectedResponses += 1
    }
  }

  // Count exchanges in resulting WARC
  const raw = Buffer.from(await mischiefToWarc(capture))
  const rawStream = Readable.from(raw)

  for await (const record of WARCParser.iterRecords(rawStream)) {
    if (record.warcType === 'warcinfo') {
      actualWarcInfo += 1
    }

    if (record.warcType === 'request') {
      actualRequests += 1
    }

    if (record.warcType === 'response') {
      actualResponses += 1
    }
  }

  assert(actualWarcInfo === 1)
  assert(expectedRequests === actualRequests)
  assert(expectedResponses === actualResponses)
})
