import assert from 'node:assert/strict'
import { constants } from 'node:fs'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import {
  createArtifactScratchDirectory,
  readArtifactFile,
  removeArtifactScratchDirectory
} from './artifact-files.js'

const execFile = promisify(execFileCallback)
const supportsSafeOpen = Boolean(constants.O_NOFOLLOW && constants.O_NONBLOCK)

async function createRoot (t) {
  const root = await mkdtemp(join(tmpdir(), 'scoop-artifact-files-'))
  t.after(async () => { await rm(root, { recursive: true, force: true }) })
  return root
}

test('reads a regular artifact from the validated file descriptor', { skip: !supportsSafeOpen }, async (t) => {
  const root = await createRoot(t)
  const scratch = await createArtifactScratchDirectory(root)
  t.after(async () => { await removeArtifactScratchDirectory(scratch) })
  const file = join(scratch.path, 'video.mp4')
  const expected = Buffer.from([0, 1, 2, 0, 255])

  await writeFile(file, expected)

  assert.deepEqual(await readArtifactFile(file), expected)
})

test('does not follow a final symlink into another file', { skip: !supportsSafeOpen }, async (t) => {
  const root = await createRoot(t)
  const scratch = await createArtifactScratchDirectory(root)
  t.after(async () => { await removeArtifactScratchDirectory(scratch) })
  const secret = join(root, 'secret.txt')
  const artifact = join(scratch.path, 'download.mp4')

  await writeFile(secret, 'fixture secret')
  await symlink(secret, artifact)

  await assert.rejects(readArtifactFile(artifact), { code: 'ELOOP' })
})

test('rejects nonregular files', { skip: !supportsSafeOpen }, async (t) => {
  const root = await createRoot(t)
  const scratch = await createArtifactScratchDirectory(root)
  t.after(async () => { await removeArtifactScratchDirectory(scratch) })

  await assert.rejects(readArtifactFile(scratch.path), { code: 'ERR_ARTIFACT_NOT_REGULAR' })
})

test('rejects FIFOs without waiting for a writer', { skip: !supportsSafeOpen || process.platform === 'win32' }, async (t) => {
  const root = await createRoot(t)
  const scratch = await createArtifactScratchDirectory(root)
  t.after(async () => { await removeArtifactScratchDirectory(scratch) })
  const fifo = join(scratch.path, 'download.mp4')

  await execFile('mkfifo', [fifo])

  await assert.rejects(
    Promise.race([
      readArtifactFile(fifo),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('FIFO open blocked')), 250))
    ]),
    { code: 'ERR_ARTIFACT_NOT_REGULAR' }
  )
})

test('creates distinct private scratch directories and removes only owned paths', async (t) => {
  const root = await createRoot(t)
  const first = await createArtifactScratchDirectory(root)
  const second = await createArtifactScratchDirectory(root)
  t.after(async () => { await removeArtifactScratchDirectory(second) })

  assert.notEqual(first.path, second.path)
  assert.equal((await stat(first.path)).mode & 0o777, 0o700)

  await assert.rejects(
    removeArtifactScratchDirectory(Object.freeze({ path: root })),
    { code: 'ERR_ARTIFACT_SCRATCH_NOT_OWNED' }
  )
  assert.equal((await stat(root)).isDirectory(), true)

  await removeArtifactScratchDirectory(first)
  await assert.rejects(stat(first.path), { code: 'ENOENT' })
  assert.equal((await stat(second.path)).isDirectory(), true)
})

test('requires an absolute trusted scratch root', async () => {
  await assert.rejects(createArtifactScratchDirectory('relative-root'), TypeError)
})

test('reports unavailable safe-open primitives', { skip: supportsSafeOpen }, async (t) => {
  const root = await createRoot(t)
  const file = join(root, 'artifact')
  await writeFile(file, 'data')

  await assert.rejects(readArtifactFile(file), { code: 'ERR_ARTIFACT_SAFE_OPEN_UNSUPPORTED' })
})
