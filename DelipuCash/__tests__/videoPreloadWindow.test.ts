/**
 * Regression tests for utils/videoPreload.ts — the source-load window policy
 * (video remediation PR 3).
 *
 * Locks: only items inside the window may attach a native player source.
 * Default window: active ±(2 ahead / 1 behind). Manual data saver: active
 * only. Cellular trim: 1 ahead / 0 behind (autoplay untouched — that's the
 * item's isActive logic, not this helper's concern).
 */
import {
  computeShouldLoad,
  PRELOAD_AHEAD,
  PRELOAD_BEHIND,
  CELLULAR_PRELOAD_AHEAD,
  CELLULAR_PRELOAD_BEHIND,
} from '@/utils/videoPreload';

describe('computeShouldLoad — default window', () => {
  it.each([
    [4, false, 'far behind'],
    [5, true, 'one behind (PRELOAD_BEHIND)'],
    [6, true, 'active index'],
    [7, true, 'one ahead'],
    [8, true, 'two ahead (PRELOAD_AHEAD)'],
    [9, false, 'past the window'],
  ])('index %i → %s (%s)', (index, expected) => {
    expect(computeShouldLoad(index, 6, {})).toBe(expected);
  });

  it('isActive always loads, even outside the window or in data saver', () => {
    expect(computeShouldLoad(99, 0, { isActive: true })).toBe(true);
    expect(computeShouldLoad(0, 0, { isActive: true, dataSaver: true })).toBe(true);
  });

  it('clamps sanely at the start of the feed (no negative-index loads implied)', () => {
    expect(computeShouldLoad(0, 0, {})).toBe(true);
    expect(computeShouldLoad(1, 0, {})).toBe(true);
    expect(computeShouldLoad(2, 0, {})).toBe(true);
    expect(computeShouldLoad(3, 0, {})).toBe(false);
  });
});

describe('computeShouldLoad — data saver', () => {
  it('loads NOTHING but the active item', () => {
    expect(computeShouldLoad(6, 6, { dataSaver: true, isActive: true })).toBe(true);
    expect(computeShouldLoad(7, 6, { dataSaver: true })).toBe(false); // next
    expect(computeShouldLoad(5, 6, { dataSaver: true })).toBe(false); // prev
  });
});

describe('computeShouldLoad — cellular trim', () => {
  it('narrows to 1 ahead / 0 behind', () => {
    expect(CELLULAR_PRELOAD_AHEAD).toBeLessThan(PRELOAD_AHEAD);
    expect(CELLULAR_PRELOAD_BEHIND).toBeLessThan(PRELOAD_BEHIND);

    expect(computeShouldLoad(7, 6, { cellularTrim: true })).toBe(true); // 1 ahead
    expect(computeShouldLoad(8, 6, { cellularTrim: true })).toBe(false); // 2 ahead
    expect(computeShouldLoad(5, 6, { cellularTrim: true })).toBe(false); // behind
  });

  it('manual data saver wins over cellular trim', () => {
    expect(computeShouldLoad(7, 6, { cellularTrim: true, dataSaver: true })).toBe(false);
  });
});

describe('computeShouldLoad — cold start (no active video yet)', () => {
  it('loads the top of the feed so first play is instant', () => {
    expect(computeShouldLoad(0, -1, {})).toBe(true);
    expect(computeShouldLoad(PRELOAD_AHEAD, -1, {})).toBe(true);
    expect(computeShouldLoad(PRELOAD_AHEAD + 1, -1, {})).toBe(false);
  });

  it('cold start respects data saver', () => {
    expect(computeShouldLoad(0, -1, { dataSaver: true })).toBe(false);
  });
});

describe('computeShouldLoad — explicit overrides', () => {
  it('honors ahead/behind overrides', () => {
    expect(computeShouldLoad(10, 6, { ahead: 4 })).toBe(true);
    expect(computeShouldLoad(3, 6, { behind: 3 })).toBe(true);
    expect(computeShouldLoad(2, 6, { behind: 3 })).toBe(false);
  });
});
