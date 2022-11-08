import test from 'node:test';
import assert from 'node:assert/strict';

import { waczToMischief } from '../../importers/waczToMischief.js'

test('exchanges should be rehydrated', async (_t) => {
  const mischief = await waczToMischief('test/fixtures/example-https-with-raw.wacz');
  assert.strictEqual(mischief.exchanges.length, 2);
})
