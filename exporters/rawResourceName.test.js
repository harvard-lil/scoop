import test from 'node:test'
import assert from 'node:assert/strict'

import { rawResourceName, parseRawResourceDate } from './rawResourceName.js'

const date = new Date('2026-07-08T15:21:43.602Z')
const id = '11fa775b-098e-4b62-aaae-37b6837ba933'

test('raw WACZ resource names use a 17-digit UTC timestamp and fit the WACZ name pattern', () => {
  const name = rawResourceName('request', date, id)

  assert.equal(name, `raw/request_20260708152143602_${id}`)
  assert.match(name, /^[-a-z0-9._/]+$/)
})

test('the timestamp in a raw resource name reads back as the same date', () => {
  const [, timestamp] = rawResourceName('response', date, id).split('_')
  assert.equal(parseRawResourceDate(timestamp).toISOString(), date.toISOString())
})

test('ISO timestamps from names written before the 17-digit form still read back', () => {
  assert.equal(parseRawResourceDate('2026-07-08T15:21:43.602Z').toISOString(), date.toISOString())
})
