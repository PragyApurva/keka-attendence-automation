import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIstDateParts, shouldFire } from '../src/scheduler.js';

test('getIstDateParts returns India time parts', () => {
  const utcDate = new Date('2026-05-13T04:30:00Z'); // 10:00 IST
  const parts = getIstDateParts(utcDate);
  assert.equal(parts.date, '2026-05-13');
  assert.equal(parts.hour, 10);
  assert.equal(parts.minute, 0);
});

// Login: fires 9:30–10:59 IST when not already clocked in
test('login does not fire before 9:30 IST', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 29 }, null), false);
  assert.equal(shouldFire('login', { hour: 8, minute: 59 }, null), false);
});

test('login fires from 9:30 through 10:59 IST when status is null', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, null), true);
  assert.equal(shouldFire('login', { hour: 9, minute: 45 }, null), true);
  assert.equal(shouldFire('login', { hour: 10, minute: 0 }, null), true);
  assert.equal(shouldFire('login', { hour: 10, minute: 59 }, null), true);
});

test('login does not fire at or after 11:00 IST', () => {
  assert.equal(shouldFire('login', { hour: 11, minute: 0 }, null), false);
  assert.equal(shouldFire('login', { hour: 14, minute: 0 }, null), false);
});

test('login skips when already clocked in', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, 'in'), false);
  assert.equal(shouldFire('login', { hour: 10, minute: 0 }, 'in'), false);
});

test('login fires when status is out (new session ok)', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, 'out'), true);
});

// Logout: fires at/after 20:30 IST only when clocked in
test('logout does not fire before 20:30 IST', () => {
  assert.equal(shouldFire('logout', { hour: 20, minute: 29 }, 'in'), false);
  assert.equal(shouldFire('logout', { hour: 19, minute: 0 }, 'in'), false);
});

test('logout fires from 20:30 IST onward when clocked in', () => {
  assert.equal(shouldFire('logout', { hour: 20, minute: 30 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 20, minute: 45 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 21, minute: 0 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 23, minute: 59 }, 'in'), true);
});

test('logout skips when not clocked in', () => {
  assert.equal(shouldFire('logout', { hour: 20, minute: 30 }, null), false);
  assert.equal(shouldFire('logout', { hour: 20, minute: 30 }, 'out'), false);
});
