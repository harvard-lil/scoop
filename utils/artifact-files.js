import { constants } from 'node:fs'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

const ownedScratchDirectories = new WeakSet()

function safeReadFlags () {
  if (!constants.O_NOFOLLOW || !constants.O_NONBLOCK) {
    const error = new Error('Safe artifact reads require O_NOFOLLOW and O_NONBLOCK support')
    error.code = 'ERR_ARTIFACT_SAFE_OPEN_UNSUPPORTED'
    throw error
  }

  return constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
}

export async function readArtifactFile (path) {
  const file = await open(path, safeReadFlags())
  try {
    if (!(await file.stat()).isFile()) {
      const error = new Error('Artifact must be a regular file')
      error.code = 'ERR_ARTIFACT_NOT_REGULAR'
      throw error
    }

    return await file.readFile()
  } finally {
    await file.close()
  }
}

export async function createArtifactScratchDirectory (root) {
  if (typeof root !== 'string' || !isAbsolute(root)) {
    throw new TypeError('Artifact scratch root must be an absolute path')
  }

  const scratch = Object.freeze({ path: await mkdtemp(join(root, 'scoop-')) })
  ownedScratchDirectories.add(scratch)
  return scratch
}

export async function removeArtifactScratchDirectory (scratch) {
  if (!ownedScratchDirectories.has(scratch)) {
    const error = new Error('Artifact scratch directory is not owned by this process')
    error.code = 'ERR_ARTIFACT_SCRATCH_NOT_OWNED'
    throw error
  }

  await rm(scratch.path, { recursive: true, force: true })
  ownedScratchDirectories.delete(scratch)
}
