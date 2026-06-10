/**
 * Video source-load window.
 *
 * The feed mounts ~5 screens of items (FlatList windowSize), but a mounted item
 * should NOT necessarily hold a loaded native player source — that's what made
 * "preloading" dishonest before: every mounted item buffered immediately while
 * the store's preload bookkeeping tracked nothing real.
 *
 * `computeShouldLoad` is the single policy for which items may attach their
 * video source:
 *  - the active item always loads;
 *  - manual data saver: ONLY the active item loads (neighbors stay sourceless —
 *    this is what makes data saver actually save data);
 *  - auto cellular trim: a narrower window (1 ahead / 0 behind) — softer than
 *    manual saver, autoplay is unaffected;
 *  - default: 2 ahead / 1 behind (the store's long-standing preload targets).
 */

export const PRELOAD_AHEAD = 2;
export const PRELOAD_BEHIND = 1;
export const CELLULAR_PRELOAD_AHEAD = 1;
export const CELLULAR_PRELOAD_BEHIND = 0;

export interface ShouldLoadOptions {
  /** This item is the active (playing) one — always loads. */
  isActive?: boolean;
  /** Manual data-saver mode — only the active item loads. */
  dataSaver?: boolean;
  /** Auto data-saver on cellular — narrows the window, keeps autoplay. */
  cellularTrim?: boolean;
  /** Override the look-ahead window (defaults per mode). */
  ahead?: number;
  /** Override the look-behind window (defaults per mode). */
  behind?: number;
}

export function computeShouldLoad(
  index: number,
  activeIndex: number,
  opts: ShouldLoadOptions = {},
): boolean {
  const { isActive = false, dataSaver = false, cellularTrim = false } = opts;

  if (isActive) return true;
  if (dataSaver) return false; // saver: nothing but the active item

  const ahead = opts.ahead ?? (cellularTrim ? CELLULAR_PRELOAD_AHEAD : PRELOAD_AHEAD);
  const behind = opts.behind ?? (cellularTrim ? CELLULAR_PRELOAD_BEHIND : PRELOAD_BEHIND);

  // Cold start (no active video yet): load the top of the feed so first play
  // is instant once viewability fires.
  if (activeIndex < 0) return index <= ahead;

  return index >= activeIndex - behind && index <= activeIndex + ahead;
}
