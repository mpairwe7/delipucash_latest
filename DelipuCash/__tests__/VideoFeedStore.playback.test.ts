/**
 * Regression tests for the VideoFeedStore single-audio playback gate.
 *
 * The vertical feed decides whether an item plays via `selectIsPlaybackAllowed`
 * (and the matching `isPlaybackAllowed()` action). Before the fix, that gate only
 * checked screen focus, app state, grid mode, and the comments sheet — it ignored
 * the full player, the mini player, and external full-screen overlays (livestream,
 * interstitial ad). The feed therefore kept playing audio behind those surfaces,
 * producing overlapping audio. These tests lock in that EVERY overlay that owns
 * its own player silences the feed, and that clearing the overlay restores it.
 */
import {
  useVideoFeedStore,
  selectIsPlaybackAllowed,
} from '@/store/VideoFeedStore';

const store = () => useVideoFeedStore.getState();
const allowed = () => selectIsPlaybackAllowed(useVideoFeedStore.getState());

beforeEach(() => {
  store().reset();
});

describe('VideoFeedStore — single-audio playback gate', () => {
  it('allows feed playback in the default focused/foreground state', () => {
    expect(allowed()).toBe(true);
    expect(store().isPlaybackAllowed()).toBe(true);
  });

  it.each([
    ['comments sheet', () => store().openComments('v1')],
    ['full player', () => store().openFullPlayer('v1')],
    ['mini player', () => store().minimizeToMiniPlayer('v1')],
    ['external overlay (livestream/interstitial)', () => store().setExternalOverlayVisible(true)],
  ])('blocks feed playback while the %s is shown', (_label, openOverlay) => {
    expect(allowed()).toBe(true);
    openOverlay();
    expect(allowed()).toBe(false);
    expect(store().isPlaybackAllowed()).toBe(false);
  });

  it('blocks playback when screen is unfocused or app is backgrounded', () => {
    store().setScreenFocused(false);
    expect(allowed()).toBe(false);
    store().setScreenFocused(true);
    expect(allowed()).toBe(true);

    store().setAppActive(false);
    expect(allowed()).toBe(false);
    store().setAppActive(true);
    expect(allowed()).toBe(true);
  });

  it('restores feed playback once an external overlay is dismissed', () => {
    store().setExternalOverlayVisible(true);
    expect(allowed()).toBe(false);
    store().setExternalOverlayVisible(false);
    expect(allowed()).toBe(true);
  });

  it('keeps the selector and the isPlaybackAllowed() action in agreement', () => {
    const surfaces: (() => void)[] = [
      () => store().openComments('v1'),
      () => store().closeComments(),
      () => store().openFullPlayer('v1'),
      () => store().closeFullPlayer(), // transitions to mini player
      () => store().closeMiniPlayer(),
      () => store().setExternalOverlayVisible(true),
      () => store().setExternalOverlayVisible(false),
    ];
    for (const mutate of surfaces) {
      mutate();
      expect(allowed()).toBe(store().isPlaybackAllowed());
    }
  });

  it('setExternalOverlayVisible is idempotent (no-op when unchanged)', () => {
    store().setExternalOverlayVisible(true);
    const first = store().isExternalOverlayVisible;
    store().setExternalOverlayVisible(true);
    expect(store().isExternalOverlayVisible).toBe(first);
  });
});
