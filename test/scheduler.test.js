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

// Login: 9:30 AM–12:59 PM IST when not already clocked in
test('login does not fire before 9:30 IST', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 29 }, null), false);
  assert.equal(shouldFire('login', { hour: 8, minute: 0 }, null), false);
});

test('login fires 9:30 AM through 12:59 PM IST when status is null', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, null), true);
  assert.equal(shouldFire('login', { hour: 10, minute: 0 }, null), true);
  assert.equal(shouldFire('login', { hour: 12, minute: 59 }, null), true);
});

test('login does not fire at or after 1:00 PM IST', () => {
  assert.equal(shouldFire('login', { hour: 13, minute: 0 }, null), false);
  assert.equal(shouldFire('login', { hour: 15, minute: 0 }, null), false);
});

test('login skips when already clocked in', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, 'in'), false);
  assert.equal(shouldFire('login', { hour: 11, minute: 0 }, 'in'), false);
});

test('login fires when status is out', () => {
  assert.equal(shouldFire('login', { hour: 9, minute: 30 }, 'out'), true);
});

// Logout: 7:45 PM–10:30 PM IST only when clocked in
test('logout does not fire before 7:45 PM IST', () => {
  assert.equal(shouldFire('logout', { hour: 19, minute: 44 }, 'in'), false);
  assert.equal(shouldFire('logout', { hour: 18, minute: 0 }, 'in'), false);
});

test('logout fires 7:45 PM through 10:30 PM IST when clocked in', () => {
  assert.equal(shouldFire('logout', { hour: 19, minute: 45 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 20, minute: 0 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 21, minute: 0 }, 'in'), true);
  assert.equal(shouldFire('logout', { hour: 22, minute: 30 }, 'in'), true);
});

test('logout does not fire after 10:30 PM IST', () => {
  assert.equal(shouldFire('logout', { hour: 22, minute: 31 }, 'in'), false);
  assert.equal(shouldFire('logout', { hour: 23, minute: 0 }, 'in'), false);
});

test('logout skips when not clocked in', () => {
  assert.equal(shouldFire('logout', { hour: 20, minute: 0 }, null), false);
  assert.equal(shouldFire('logout', { hour: 20, minute: 0 }, 'out'), false);
});
