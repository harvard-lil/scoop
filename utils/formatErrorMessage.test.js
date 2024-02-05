import test from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'fs/promises'
import { FIXTURES_PATH } from '../constants.js'

import { formatErrorMessage } from './formatErrorMessage.js'

test('formatErrorMessage should strip colors', async (_t) => {
  try {
    throw new Error('\u001B[0m\u001B[4m\u001B[42m\u001B[31mfoo\u001B[39m\u001B[49m\u001B[24mfoo\u001B[0m')
  } catch (err) {
    assert(formatErrorMessage(err) === 'foofoo')
  }
})

test('formatErrorMessage should truncate length', async (_t) => {
  try {
    throw new Error('a'.repeat(200))
  } catch (err) {
    assert(formatErrorMessage(err) === 'a'.repeat(100) + '...')
  }
})

test('formatErrorMessage should strip block formatting', async (_t) => {
  const actualErrorMessage = await readFile(`${FIXTURES_PATH}error.txt`)
  try {
    throw new Error(actualErrorMessage)
  } catch (err) {
    assert(formatErrorMessage(err) === 'browserType.launch: Looks like you launched a headed browser without having a XServer running. Set e...')
  }
})

test('formatErrorMessage handles arbitrary object', async (_t) => {
  try {
    throw new Error(NaN)
  } catch (err) {
    formatErrorMessage(err)
  }
})

test('formatErrorMessage handles string', async (_t) => {
  try {
    throw 'hi'  //eslint-disable-line
  } catch (err) {
    assert(formatErrorMessage(err) === 'hi')
  }
})

test('formatErrorMessage handles exception', async (_t) => {
  try {
    throw new Error('hi')
  } catch (err) {
    assert(formatErrorMessage(err) === 'hi')
  }
})
