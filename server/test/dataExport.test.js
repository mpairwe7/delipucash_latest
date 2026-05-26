/**
 * Smoke checks for the data-export module shape.
 * Full end-to-end exercise (DB → R2 → email) lives in integration tests.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

test('dataExport module exports exportUserData function', async () => {
  const mod = await import('../lib/dataExport.mjs');
  assert.equal(typeof mod.exportUserData, 'function');
});
