import test from 'node:test'
import assert from 'node:assert/strict'

import { exec, omitEnvironmentVariables } from './exec.js'

const child = new URL('./fixtures/exec-child.js', import.meta.url).pathname

function runChild (args, options) {
  return exec(process.execPath, [child, ...args], options)
}

test('passes literal arguments without invoking a shell', async () => {
  const literal = '/tmp/a b/$(echo injected); "quoted"; *'
  const result = await runChild(['args', literal])

  assert.deepEqual(JSON.parse(result), [literal])
})

test('runs a child with selected environment variables omitted from a copied environment', async () => {
  const processEnvironmentBefore = { ...process.env }
  const environment = {
    ...process.env,
    no_proxy: '127.0.0.1',
    NO_PROXY: '*',
    SCOOP_EXEC_TEST_PRESERVED: 'preserved'
  }
  const childEnvironment = omitEnvironmentVariables(environment, ['no_proxy', 'NO_PROXY'])
  const inspectEnvironment = `
    process.stdout.write(JSON.stringify({
      no_proxy: process.env.no_proxy ?? null,
      NO_PROXY: process.env.NO_PROXY ?? null,
      preserved: process.env.SCOOP_EXEC_TEST_PRESERVED
    }))
  `

  assert.deepEqual(JSON.parse(await exec(process.execPath, ['-e', inspectEnvironment], {
    env: childEnvironment
  })), {
    no_proxy: null,
    NO_PROXY: null,
    preserved: 'preserved'
  })
  assert.equal(environment.no_proxy, '127.0.0.1')
  assert.equal(environment.NO_PROXY, '*')
  assert.equal(environment.SCOOP_EXEC_TEST_PRESERVED, 'preserved')
  assert.deepEqual({ ...process.env }, processEnvironmentBefore)
})

test('rejects shell execution even when requested in options', async () => {
  await assert.rejects(
    runChild(['args', 'safe'], { shell: true }),
    { name: 'TypeError', message: 'exec does not support shell execution' }
  )
})

test('writes empty strings and buffers to stdin, then closes it', async () => {
  assert.deepEqual(JSON.parse(await runChild(['stdin'], { input: '' })), { length: 0, text: '' })
  assert.deepEqual(JSON.parse(await runChild(['stdin'], { input: Buffer.from('buffer input') })), {
    length: 12,
    text: 'buffer input'
  })
})

test('retains native failure metadata and stderr', async () => {
  await assert.rejects(runChild(['exit']), (error) => {
    assert.equal(error.code, 7)
    assert.equal(error.stdout, 'standard output')
    assert.equal(error.stderr, 'standard error')
    return true
  })
})

test('reports unavailable executables', async () => {
  await assert.rejects(exec('scoop-exec-test-does-not-exist'), { code: 'ENOENT' })
})

test('uses native output and timeout limits', async () => {
  await assert.rejects(runChild(['output', 'abcdef'], { maxBuffer: 4 }), (error) => {
    assert.equal(error.code, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')
    assert.equal(error.stdout, 'abcd')
    return true
  })

  await assert.rejects(runChild(['hang'], { timeout: 25 }), (error) => {
    assert.equal(error.killed, true)
    assert.equal(error.signal, 'SIGTERM')
    return true
  })
})

test('passes AbortSignal to execFile', async () => {
  const controller = new AbortController()
  const promise = runChild(['hang'], { signal: controller.signal })
  controller.abort()
  await assert.rejects(promise, { name: 'AbortError', code: 'ABORT_ERR' })
})
