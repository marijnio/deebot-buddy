import test from 'node:test';
import assert from 'node:assert/strict';
import { getCycleProgressPercent, isSameLocalDay } from './date.js';

test('isSameLocalDay matches timestamps on the same local calendar day', () => {
  const morning = new Date(2026, 10, 25, 8, 0, 0).toISOString();
  const evening = new Date(2026, 10, 25, 21, 0, 0);
  const yesterday = new Date(2026, 10, 24, 23, 59, 59).toISOString();
  const tomorrow = new Date(2026, 10, 26, 0, 0, 1).toISOString();

  assert.equal(isSameLocalDay(morning, evening), true);
  assert.equal(isSameLocalDay(yesterday, evening), false);
  assert.equal(isSameLocalDay(tomorrow, evening), false);
  assert.equal(isSameLocalDay(null, evening), false);
  assert.equal(isSameLocalDay('not-a-date', evening), false);
});

test('getCycleProgressPercent returns 0 when completed today without an override', () => {
  const ref = new Date(2026, 10, 25, 21, 0, 0);
  const todayMorning = new Date(2026, 10, 25, 8, 0, 0).toISOString();

  assert.equal(
    getCycleProgressPercent(
      { last_at: ref.toISOString(), progress_clamped: 0, is_override: false },
      ref
    ),
    0
  );
  assert.equal(
    getCycleProgressPercent(
      { last_at: todayMorning, progress_clamped: 16.7, is_override: false },
      ref
    ),
    0
  );
});

test('getCycleProgressPercent respects overrides and previous days without a 4% floor', () => {
  const ref = new Date(2026, 10, 25, 21, 0, 0);
  const todayMorning = new Date(2026, 10, 25, 8, 0, 0).toISOString();
  const yesterday = new Date(2026, 10, 24, 21, 0, 0).toISOString();

  assert.equal(
    getCycleProgressPercent(
      { last_at: todayMorning, progress_clamped: 100, is_override: true },
      ref
    ),
    100
  );
  assert.equal(
    getCycleProgressPercent(
      { last_at: yesterday, progress_clamped: 33.3, is_override: false },
      ref
    ),
    33.3
  );
  assert.equal(
    getCycleProgressPercent(
      { last_at: yesterday, progress_clamped: 0.4, is_override: false },
      ref
    ),
    0.4
  );
  assert.equal(
    getCycleProgressPercent(
      { last_at: yesterday, progress_clamped: 0, is_override: true },
      ref
    ),
    0
  );
  assert.equal(getCycleProgressPercent(null, ref), 0);
});
