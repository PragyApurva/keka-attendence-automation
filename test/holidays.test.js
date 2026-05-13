import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHoliday, holidayName, istDateString } from '../src/holidays.js';

test('istDateString formats YYYY-MM-DD', () => {
  // 2026-08-15 00:00 IST = 2026-08-14 18:30 UTC
  const d = new Date('2026-08-14T18:30:00Z');
  assert.equal(istDateString(d), '2026-08-15');
});

test('Independence Day 2026 is a holiday', () => {
  const d = new Date('2026-08-15T05:00:00Z'); // 10:30 IST
  assert.equal(holidayName(d), 'Independence Day');
  assert.equal(isHoliday(d), true);
});

test('Republic Day 2026 is a holiday', () => {
  const d = new Date('2026-01-26T05:00:00Z');
  assert.equal(holidayName(d), 'Republic Day');
});

test('regular weekday is not a holiday', () => {
  const d = new Date('2026-05-12T05:00:00Z'); // Tue
  assert.equal(isHoliday(d), false);
  assert.equal(holidayName(d), null);
});
