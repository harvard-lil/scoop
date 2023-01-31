import test from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'fs/promises'

import { FIXTURES_PATH } from '../constants.js'
import { hash } from './WACZ.js'

import {
  assertString,
  assertISO8601Date,
  assertBase64,
  assertSHA256WithPrefix,
  assertPEMCertificateChain,
  assertDomainName
} from './assertions.js'

test('assertString throws on non-strings', async (_t) => {
  assert.doesNotThrow(() => assertString('test'))
  assert.doesNotThrow(() => assertString(new String('test'))) // eslint-disable-line
  assert.throws(() => assertString(123))
  assert.throws(() => assertString({}))
  assert.throws(() => assertString([]))
  assert.throws(() => assertString(/test/))
})

test('assertISO8601Date throws on non-ISO8601 dates', async (_t) => {
  assert.doesNotThrow(() => assertISO8601Date((new Date()).toISOString()))
  assert.throws(() => assertISO8601Date((new Date()).toUTCString()))
})

test('assertBase64 throws on non-base64 encoded strings', async (_t) => {
  assert.doesNotThrow(() => assertBase64(Buffer.from('test/test').toString('base64')))
  assert.throws(() => assertBase64(Buffer.from('test/test').toString('ascii')))
})

test('assertSHA256WithPrefix throws on non-sha256 strings', async (_t) => {
  assert.doesNotThrow(() => assertSHA256WithPrefix(hash(Buffer.from('test'))))
  assert.throws(() => assertSHA256WithPrefix('test'))
})

test('assertPEMCertificateChain throws on non-sha256 strings', async (_t) => {
  const pem = await readFile(`${FIXTURES_PATH}example.pem`)
  assert.doesNotThrow(() => assertPEMCertificateChain(pem))
  assert.throws(() => assertPEMCertificateChain('test'))
})

test('assertDomainName throws on non-domain strings', async (_t) => {
  assert.doesNotThrow(() => assertDomainName('test.example.com'))
  assert.throws(() => assertDomainName('testexample.'))
})
