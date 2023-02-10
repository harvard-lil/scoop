import test from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'fs/promises'
import express from 'express'

import { FIXTURES_PATH } from './constants.js'
import { defaultOptions } from './options.js'
import { Mischief } from './Mischief.js'

const app = express()
const PORT = 3000
const URL = `http://localhost:${PORT}`

const testHtmlFixture = await readFile(`${FIXTURES_PATH}test.html`)

/*
 * Copy everything from defaultOptions over but set all booleans to false
 * so that we can selectively test each flag
 */
const options = { logLevel: 'silent', headless: true, blocklist: [] }
Object.entries(defaultOptions).forEach(([k, v]) => {
  options[k] = options[k] || ((v === true) ? false : v)
})
Object.freeze(options)

/*
 * SETUP
 */
const server = await app.listen(PORT, () => console.log(`Test webserver started on port ${PORT}`))
app.get('/redirect', (req, res) => res.redirect(parseInt(req.query.statusCode), req.query.path))
app.get('/:path', (req, res) => res.sendFile(FIXTURES_PATH + req.params.path))

/*
 * TESTS
 */
await test('Mischief captures the body of an html document', async (_t) => {
  const { exchanges: [html] } = await Mischief.capture(`${URL}/test.html`, options)
  assert.equal(html.response.body.toString(), testHtmlFixture.toString())
})

await test('Mischief follows redirects', async (_t) => {
  const statusCode = 301
  const { exchanges: [redirect, html] } = await Mischief.capture(`${URL}/redirect?statusCode=${statusCode}&path=test.html`, options)
  assert.equal(redirect.response.startLine.split(' ')[1], statusCode.toString())
  assert.equal(html.response.body.toString(), testHtmlFixture.toString())
})

await test('Mischief captures a screenshot', async (_t) => {
  const testScreenshotFixture = await readFile(`${FIXTURES_PATH}test.png`)
  const { exchanges: [, screenshot] } = await Mischief.capture(`${URL}/test.html`, { ...options, screenshot: true })
  assert.notStrictEqual(screenshot.response.body, testScreenshotFixture)
})

/*
 * TEARDOWN
 */
server.close()
