import test from 'node:test'
import assert from 'node:assert/strict'
import { SnapshotTimeoutError, withSnapshotDeadline } from './snapshot-deadline.js'

test('a stalled snapshot cancels browser work before returning the timeout', async () => {
  let rejectOperation
  let cancelled = false
  await assert.rejects(withSnapshotDeadline(
    () => new Promise((resolve, reject) => { rejectOperation = reject }),
    async () => { cancelled = true; rejectOperation(new Error('browser closed')) },
    10
  ), SnapshotTimeoutError)
  assert.equal(cancelled, true)
})

test('successful snapshots and ordinary errors do not close the browser', async () => {
  const cancel = () => assert.fail('Unexpected cancellation')
  assert.deepEqual(await withSnapshotDeadline(() => Buffer.from('pdf'), cancel, 100), Buffer.from('pdf'))
  await assert.rejects(withSnapshotDeadline(() => { throw new Error('ordinary failure') }, cancel, 100), /ordinary failure/)
})
