import test from 'node:test'
import assert from 'node:assert/strict'

import CONSTANTS from './constants.js'
import { defaultOptions, filterOptions } from './options.js'

export const defaultTestOptions = {
  ...defaultOptions,
  headless: true,
  captureVideoAsAttachment: false
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
