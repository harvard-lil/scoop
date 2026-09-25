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
  app.get('/tall', (req, res) => res.send('<!DOCTYPE html><body style="margin:0"><div style="width:800px;height:5000px;background:linear-gradient(red,blue)"></div></body>'))
  // Refuses HEAD with a JSON error, as some servers do, but serves HTML to GET.
  app.head('/head-refused', (req, res) => res.status(405).json({ error: 'Method Not Allowed' }))
  app.get('/head-refused', (req, res) => res.sendFile(`${FIXTURES_PATH}test.html`))
  app.get('/:path', (req, res) => res.sendFile(FIXTURES_PATH + req.params.path))

  const testVideoFixture = await readFile(`${FIXTURES_PATH}video.mp4`)

  /*
   * TESTS
   */
  await t.test('Scoop captures the body of an html document', async (_t) => {
    const { exchanges: [html] } = await Scoop.capture(`${URL}/test.html`, options)
    assert.equal(html.response.body.toString(), testHtmlFixture.toString())
  })

  await t.test('Scoop captures a page in the browser when the server refuses HEAD requests', async (_t) => {
    const capture = await Scoop.capture(`${URL}/head-refused`, options)
    assert.equal(capture.targetUrlIsWebPage, true)
    assert.equal(capture.exchanges[0].response.body.toString(), testHtmlFixture.toString())
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
    const attachment = exchanges.filter(
      ex => ex.url === 'file:///video-extracted-1.mp4'
    )[0]
    assert.deepEqual(attachment.response.body, testVideoFixture)
  })

  await t.test('Scoop observes maxVideoCaptureSize', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, captureVideoAsAttachment: true, maxVideoCaptureSize: 50000 })
    const urls = exchanges.map(ex => ex.url)
    const expected = [
      'file:///video-extracted-1.mp4',
      'file:///video-extracted-metadata.json',
      'file:///video-extracted-summary.html'
    ]
    assert.deepEqual(expected.filter(url => urls.includes(url)), [])
  })

  await t.test('Scoop can be configured for different window dimensions', async (_t) => {
    const xy = 600
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, screenshot: true, captureWindowX: xy, captureWindowY: xy })
    const attachment = exchanges[exchanges.length - 1]
    assert.deepEqual(getDimensions(attachment.response.body), [xy, xy])
  })

  await t.test('Scoop clips a full-page screenshot to screenshotMaxHeight', async (_t) => {
    const unbounded = await Scoop.capture(`${URL}/tall`, { ...options, screenshot: true })
    assert.deepEqual(getDimensions(unbounded.exchanges.at(-1).response.body), [options.captureWindowX, 5000])

    const { exchanges } = await Scoop.capture(`${URL}/tall`, { ...options, screenshot: true, screenshotMaxHeight: 2000 })
    assert.deepEqual(getDimensions(exchanges.at(-1).response.body), [options.captureWindowX, 2000])
  })

  await t.test('Scoop clips a full-page screenshot to screenshotMaxWidth', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/tall`, { ...options, screenshot: true, screenshotMaxWidth: 700, screenshotMaxHeight: 1000 })
    assert.deepEqual(getDimensions(exchanges.at(-1).response.body), [700, 1000])
  })

  await t.test('Screenshot limits larger than the page leave the screenshot whole', async (_t) => {
    const { exchanges } = await Scoop.capture(`${URL}/test.html`, { ...options, screenshot: true, screenshotMaxWidth: 16000, screenshotMaxHeight: 16000 })
    assert.deepEqual(getDimensions(exchanges.at(-1).response.body), [options.captureWindowX, options.captureWindowY])
  })

  await t.test('Scoop records what each step did', async (_t) => {
    const capture = await Scoop.capture(`${URL}/test.html`, { ...options, screenshot: true })
    const { steps } = await capture.summary()
    const screenshot = steps.find(step => step.name === 'Screenshot')
    assert.equal(screenshot.outcome, 'completed')
    assert(screenshot.durationMs >= 0)
    assert(!Number.isNaN(Date.parse(screenshot.startedAt)))
    assert.equal(steps.find(step => step.name === 'Wait for initial page load').outcome, 'completed')
    for (const step of steps) {
      assert(['completed', 'failed', 'limit', 'interrupted', 'skipped'].includes(step.outcome), step.name)
    }
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
    assert.equal(summary.targetUrlResolved, capture.targetUrlResolved)
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
