import test from 'node:test'
import assert from 'node:assert/strict'

import * as CONSTANTS from './constants.js'
import { defaultOptions, filterOptions } from './options.js'

/**
 * Basic set of options to be used with Mischief for automated testing purposes.
 * @ignore
 */
export const defaultTestOptions = {
  ...defaultOptions,
  headless: true,
  captureVideoAsAttachment: false,
  provenanceSummary: true,
  proxyPort: 5000 + Math.floor(Math.random() * 5000) // Since each test runs in a different context, they should all get a different port
}

test('filterOptions: invalid or empty argument should return full defaults.', async (_t) => {
  for (const input of [{}, [], null, undefined, true, 'FOO', () => {}]) {
    const options = filterOptions(input)

    assert(options !== defaultOptions)
    assert(Object.keys(options).length === Object.keys(defaultOptions).length)

    for (const key of Object.keys(options)) {
      assert(options[key] === defaultOptions[key])
    }
  }
})

test('filterOptions: entries that are not provided should be filled with defaults.', async (_t) => {
  const newOptions = { logLevel: 'trace', screenshot: false, captureWindowX: 1920, captureWindowY: 1080 }

  for (const [key, value] of Object.entries(filterOptions(newOptions))) {
    // Modified
    if (key in newOptions) {
      assert(value === newOptions[key])
    // Default
    } else {
      assert(value === defaultOptions[key])
    }
  }
})

test('filterOptions: entries are typecast based on defaults.', async (_t) => {
  const newOptions = filterOptions({
    screenshot: 0,
    captureWindowX: '1920',
    captureWindowY: '1080',
    intercepter: 12
  })

  for (const key of Object.keys(newOptions)) {
    assert(newOptions[key].constructor === defaultOptions[key].constructor)
  }
})

test('filterOptions: pdfSnapshot cannot be activated in headless mode.', async (_t) => {
  assert.throws(() => {
    filterOptions({ pdfSnapshot: true, headless: false })
  })
})

test('filterOptions: ytDlpPath must be a valid path to a file.', async (_t) => {
  assert.doesNotThrow(() => filterOptions()) // Default should not throw

  for (const ytDlpPath of [null, false, true, 12, () => {}, 'FOO', CONSTANTS.TMP_PATH]) {
    assert.throws(() => filterOptions({ ytDlpPath }))
  }
})
