export class SnapshotTimeoutError extends Error {}

/** Cancel browser work before continuing with non-browser capture artifacts. */
export async function withSnapshotDeadline (operation, cancel, timeout = 10000) {
  let timer
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new SnapshotTimeoutError('Browser snapshot exceeded its deadline')), timeout)
  })
  try {
    return await Promise.race([Promise.resolve().then(operation), deadline])
  } catch (error) {
    if (error instanceof SnapshotTimeoutError) await cancel()
    throw error
  } finally {
    clearTimeout(timer)
  }
}
