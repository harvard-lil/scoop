import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readFile } from 'fs/promises'
import express from 'express'

import { FIXTURES_PATH } from './constants.js'
import { isPNG, getDimensions } from './utils/png.js'
import { isPDF, getPageCount } from './utils/pdf.js'
import { defaults } from './options.js'
import { Scoop } from './Scoop.js'

await test('Scoop - capture of a web page.', async (t) => {
  const app = express()
  const PORT = 3000
  const URL = `http://localhost:${PORT}`

  const testHtmlFixture = await readFile(`${FIXTURES_PATH}test.html`)

  /*
   * Copy everything from defaults over but set all booleans to false
   * so that we can selectively test each flag
   */
  const options = { logLevel: 'silent', headless: true, blocklist: [] }
  Object.entries(defaults).forEach(([k, v]) => {
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
  await t.test('Scoop captures the body of an html document', async (_t) => {
    const { exchanges: [html] } = await Scoop.capture(`${URL}/test.html`, options)
    assert.equal(html.response.body.toString(), testHtmlFixture.toString())
  })

  await t.test('Scoop follows redirects', async (_t) => {
    const statusCode = 301
    const { exchanges: [redirect, html] } = await Scoop.capture(`${URL}/redirect?statusCode=${statusCode}&path=test.html`, options)
    assert.equal(redirect.response.startLine.split(' ')[1], statusCode.toString())
    assert.equal(html.response.body.toString(), testHtmlFixture.toString())
  })

  await t.test('Scoop captures a png screenshot', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, screenshot: true })
    const attachment = exchanges[exchanges.length - 1]
    assert(isPNG(attachment.response.body))
    assert.deepEqual(getDimensions(attachment.response.body), [options.captureWindowX, options.captureWindowY])
  })

  await t.test('Scoop captures a pdf snapshot', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, pdfSnapshot: true })
    const attachment = exchanges[exchanges.length - 1]
    assert(isPDF(attachment.response.body))
    assert.equal(getPageCount(attachment.response.body), 1)
  })

  await t.test('Scoop captures video as an attachment', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, captureVideoAsAttachment: true })
    const urls = exchanges.map(ex => ex.url)
    const expected = [
      'file:///video-extracted-1.mp4',
      'file:///video-extracted-metadata.json',
      'file:///video-extracted-summary.html'
    ]
    assert.deepEqual(expected.filter(url => urls.includes(url)), expected)
  })

  await t.test('Scoop can be configured for different window dimensions', async (_t) => {
    const xy = 600
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, screenshot: true, captureWindowX: xy, captureWindowY: xy })
    const attachment = exchanges[exchanges.length - 1]
    assert.deepEqual(getDimensions(attachment.response.body), [xy, xy])
  })

  await t.test('Scoop adds a provenance summary html page', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, provenanceSummary: true })
    const attachment = exchanges[exchanges.length - 1]
    assert.equal(attachment.url, 'file:///provenance-summary.html')
    assert(attachment.response.body.includes('<!DOCTYPE html>'))
  })

  await t.test('Scoop.summary() returns a valid object', async (_t) => {
    const capture = await Scoop.capture(`${URL}/test.html`, { ...options, provenanceSummary: true })
    const summary = await capture.summary()
    assert(summary)
    assert.equal(summary.targetUrl, capture.url)
    assert.equal(summary.targetUrlContentType, 'text/html; charset=UTF-8')
    assert.equal(summary.state, Scoop.states.COMPLETE)
    assert.equal(summary.exchangeUrls.length, capture.exchanges.length)
    assert.equal(summary.attachments.provenanceSummary, 'provenance-summary.html')
  })

  /*
   * TEARDOWN
   */
  server.close()
})

await test('Scoop - capture of a non-web resource.', async (t) => {
  const app = express()
  const PORT = 3000
  const URL = `http://localhost:${PORT}`

  const options = { logLevel: 'silent', headless: true, blocklist: [], attachmentsBypassLimits: false }

  const testPdfFixture = await readFile(`${FIXTURES_PATH}test.pdf`)

  /*
   * SETUP
   */
  const server = await app.listen(PORT, () => console.log(`Test webserver started on port ${PORT}`))
  app.get('/redirect', (req, res) => res.redirect(parseInt(req.query.statusCode), req.query.path))
  app.get('/:path', (req, res) => res.sendFile(FIXTURES_PATH + req.params.path))

  /*
   * TESTS
   */
  await t.test('Scoop captures the body of the PDF document', async (_t) => {
    const { exchanges: [html] } = await Scoop.capture(`${URL}/test.pdf`, options)
    assert.deepEqual(html.response.body, testPdfFixture)
  })

  await t.test('Scoop out-of-browser capture accounts for maxCaptureSize', async (_t) => {
    const { exchanges: [html] } = await Scoop.capture(`${URL}/test.pdf`, { ...options, maxCaptureSize: 1000 })
    assert.notEqual(html.response.body.byteLength, 0)
    assert.notEqual(html.response.body, testPdfFixture)
  })

  await t.test('Scoop out-of-browser capture accounts for captureTimeout', async (_t) => {
    const { exchanges: [html] } = await Scoop.capture(`${URL}/test.pdf`, { ...options, captureTimeout: 10 })
    assert.equal(html, undefined) // Scoop's intercepter shouldn't have had time to boot up
    // assert.notEqual(html.response.body.byteLength, testPdfFixture.byteLength)
    // assert.notEqual(html.response.body, testPdfFixture)
  })

  await t.test('Scoop.summary() returns a valid object', async (_t) => {
    const capture = await Scoop.capture(`${URL}/test.pdf`, options)
    const summary = await capture.summary()
    assert(summary)
    assert.equal(summary.targetUrl, capture.url)
    assert.equal(summary.targetUrlContentType, 'application/pdf')
    assert.equal(summary.state, Scoop.states.PARTIAL)
    assert.equal(summary.exchangeUrls.length, capture.exchanges.length)
  })

  /*
   * TEARDOWN
   */
  server.close()
})
