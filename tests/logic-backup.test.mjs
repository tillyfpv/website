import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackup, parseBackup } from '../akku-tracker/logic.mjs';

test('creates a complete versioned backup', () => {
  const b = createBackup({ batteries: [{ id: 'BAT-1' }], copters: [{ id: 'COP-1' }], events: [{ batteryId: 'BAT-1' }], lastCopterByCells: { 6: 'COP-1' }, lastScanAt: { 'BAT-1': 123 } });
  assert.equal(b.format, 'akku-tracker-backup');
  assert.equal(b.version, 1);
  assert.deepEqual(b.copters, [{ id: 'COP-1' }]);
  assert.deepEqual(b.lastCopterByCells, { 6: 'COP-1' });
});

test('accepts the existing unversioned export', () => {
  const b = parseBackup(JSON.stringify({ batteries: [{ id: 'BAT-1' }], copters: [], events: [{ batteryId: 'BAT-1' }] }));
  assert.equal(b.version, 0);
  assert.deepEqual(b.lastScanAt, {});
});

test('rejects invalid backup formats', () => {
  assert.throws(() => parseBackup('{"batteries":[]}'), /Backup-Format/);
});
