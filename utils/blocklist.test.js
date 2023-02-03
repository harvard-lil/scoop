import test from 'node:test'
import assert from 'node:assert/strict'

import { Address4, Address6 } from '@laverdet/beaugunderson-ip-address'

import { castBlocklistMatcher, searchBlocklistFor } from './blocklist.js'

const listFixture = Object.freeze([
  '1.2.3.4',
  '::1234:5678',
  '0.0.0.0/8',
  '100::/64',
  'http://example.com',
  '/.*\.jpg$/' // eslint-disable-line
].map(castBlocklistMatcher))

test('castBlocklistMatcher should only accept strings.', async (_t) => {
  assert.doesNotThrow(() => castBlocklistMatcher('test'))
  assert.doesNotThrow(() => castBlocklistMatcher(new String('test'))) // eslint-disable-line
  assert.throws(() => castBlocklistMatcher({}))
  assert.throws(() => castBlocklistMatcher(/regex/))
  assert.throws(() => castBlocklistMatcher([]))
})

test('castBlocklistMatcher should cast IPv4 addresses.', async (_t) => {
  assert.equal(castBlocklistMatcher('1.2.3.4').constructor, Address4)
})

test('castBlocklistMatcher should cast IPv6 addresses.', async (_t) => {
  assert.equal(castBlocklistMatcher('::1234:5678').constructor, Address6)
})

test('castBlocklistMatcher should cast regular expressions.', async (_t) => {
  assert.notStrictEqual(castBlocklistMatcher('/test/'), /test/)
})

test('castBlocklistMatcher should leave non-IP non-regex strings untouched.', async (_t) => {
  assert.equal(castBlocklistMatcher('test'), 'test')
})

test('searchBlocklistFor should match exact IPv4 addresses.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('1.2.3.4')))
})

test('searchBlocklistFor should match exact IPv6 addresses.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('::1234:5678')))
})

test('searchBlocklistFor should match within IPv4 ranges.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('0.255.255.255')))
  assert(!listFixture.find(searchBlocklistFor('255.255.255.255')))
})

test('searchBlocklistFor should match within IPv6 ranges.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('0100:0000:0000:0000:FFFF:FFFF:FFFF:FFFF')))
  assert(!listFixture.find(searchBlocklistFor('FFFF:0000:0000:0000:FFFF:FFFF:FFFF:FFFF')))
})

test('searchBlocklistFor should match exact strings.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('http://example.com')))
  assert(!listFixture.find(searchBlocklistFor('https://example.com')))
})

test('searchBlocklistFor should match regular expressions.', async (_t) => {
  assert(listFixture.find(searchBlocklistFor('image.jpg')))
  assert(!listFixture.find(searchBlocklistFor('image.jpgsareawesome')))
})
