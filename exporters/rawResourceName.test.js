import test from 'node:test'
import assert from 'node:assert/strict'

import { rawResourceName } from './rawResourceName.js'

test('raw WACZ resource names contain only portable lowercase characters', () => {
  const name = rawResourceName(
    'request',
    new Date('2026-07-08T15:21:43.602Z'),
    '11fa775b-098e-4b62-aaae-37b6837ba933'
  )

  assert.equal(
    name,
    'raw/request_2026-07-08t15-21-43-602z_11fa775b-098e-4b62-aaae-37b6837ba933'
  )
  assert.match(name, /^[-a-z0-9._/]+$/)
})
