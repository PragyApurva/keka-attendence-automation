import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIstDateParts, isInPunchWindow } from '../src/scheduler.js';

test('getIstDateParts returns India time parts', () => {
  const utcDate = new Date('2026-05-13T04:30:00Z'); // 10:00 IST
  const parts = getIstDateParts(utcDate);
  assert.equal(parts.date, '2026-05-13');
  assert.equal(parts.hour, 10);
  assert.equal(parts.minute, 0);
});

test('login window is only 09:25-09:35 IST', () => {
  assert.equal(isInPunchWindow('login', { hour: 9, minute: 24 }), false);
  assert.equal(isInPunchWindow('login', { hour: 9, minute: 25 }), true);
  assert.equal(isInPunchWindow('login', { hour: 9, minute: 30 }), true);
  assert.equal(isInPunchWindow('login', { hour: 9, minute: 35 }), true);
  assert.equal(isInPunchWindow('login', { hour: 9, minute: 36 }), false);
  assert.equal(isInPunchWindow('login', { hour: 10, minute: 0 }), false);
});

test('logout window is only 20:25-20:35 IST', () => {
  assert.equal(isInPunchWindow('logout', { hour: 20, minute: 24 }), false);
  assert.equal(isInPunchWindow('logout', { hour: 20, minute: 25 }), true);
  assert.equal(isInPunchWindow('logout', { hour: 20, minute: 30 }), true);
  assert.equal(isInPunchWindow('logout', { hour: 20, minute: 35 }), true);
  assert.equal(isInPunchWindow('logout', { hour: 20, minute: 36 }), false);
  assert.equal(isInPunchWindow('logout', { hour: 21, minute: 0 }), false);
});
