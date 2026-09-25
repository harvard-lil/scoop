import { test } from 'node:test'
import assert from 'node:assert/strict'

import { describeVersion } from './version.js'

test('a prerelease reports the commit it was built from', () => {
  assert.equal(describeVersion('0.7.1-dev.0', '1a2b3c4d5e6f'), '0.7.1-dev.0+1a2b3c4')
})

test('a release reports its version alone', () => {
  assert.equal(describeVersion('0.7.1', '1a2b3c4d5e6f'), '0.7.1')
})

test('a prerelease without build info reports its version alone', () => {
  assert.equal(describeVersion('0.7.1-dev.0', null), '0.7.1-dev.0')
})
