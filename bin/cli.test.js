import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Scoop } from '../Scoop.js'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.js')

await test('CLI writes the JSON summary of a failed capture', async (_t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scoop-cli-'))
  const summaryPath = path.join(dir, 'summary.json')

  try {
    const exitCode = await new Promise(resolve => {
      execFile('node', [
        // Chromium refuses port 9 (discard) outright, so navigation fails
        // whatever is listening there. A merely closed port would not do:
        // Chromium renders its own error page, and the capture completes.
        CLI, 'http://127.0.0.1:9/',
        '--output', path.join(dir, 'archive.wacz'),
        '--json-summary-output', summaryPath,
        '--blocklist', '',
        // Test files run in parallel; the default proxy port may be taken.
        '--proxy-port', String(Math.floor(5000 + Math.random() * 5000)),
        '--headless', 'true',
        '--log-level', 'silent',
        '--capture-video-as-attachment', 'false',
        '--capture-certificates-as-attachment', 'false',
        '--load-timeout', '2000'
      ], (err) => resolve(err ? err.code : 0))
    })

    assert.equal(exitCode, 1)
    const summary = JSON.parse(await readFile(summaryPath, 'utf-8'))
    assert.equal(summary.state, Scoop.states.FAILED)
    assert.equal(summary.states[summary.state], 'FAILED')
    assert(Array.isArray(summary.steps) && summary.steps.length > 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
