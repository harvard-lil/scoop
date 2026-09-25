import { test } from 'node:test'
import assert from 'node:assert/strict'

import { forEachHttpsHostWithinBudget } from './host-budget.js'

test('each https host is attempted once, failed or not', async () => {
  const attempts = []
  await forEachHttpsHostWithinBudget(
    ['https://a.test/1', 'http://b.test/', 'https://a.test/2', 'https://c.test/', 'https://c.test/x'],
    10000,
    async (host) => {
      attempts.push(host)
      if (host === 'a.test') throw new Error('no certificate')
    }
  )
  assert.deepEqual(attempts, ['a.test', 'c.test'])
})

test('attempts share one budget and each is given what is left of it', async () => {
  let clock = 0
  const given = []
  await assert.rejects(
    forEachHttpsHostWithinBudget(
      ['https://a.test/', 'https://b.test/', 'https://c.test/', 'https://d.test/'],
      10000,
      async (host, remaining) => {
        given.push([host, remaining])
        clock += 4000
      },
      { now: () => clock }
    ),
    /Time budget reached/
  )
  assert.deepEqual(given, [['a.test', 10000], ['b.test', 6000], ['c.test', 2000]])
})

test('errors are reported and do not stop the loop', async () => {
  const errors = []
  await forEachHttpsHostWithinBudget(
    ['https://a.test/', 'https://b.test/'],
    10000,
    async (host) => { throw new Error(`failed ${host}`) },
    { onError: (host, err) => errors.push([host, err.message]) }
  )
  assert.deepEqual(errors, [['a.test', 'failed a.test'], ['b.test', 'failed b.test']])
})
