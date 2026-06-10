/**
 * Regression tests for utils/videoOverlayGate.ts — the single-audio rule's
 * overlay union (video remediation PR 4).
 *
 * Locks: every overlay on the video screen that covers the feed (or owns its
 * own audio) silences the feed, INCLUDING the options sheet — previously the
 * only overlay missing from the union, so feed audio kept playing under the
 * report/block sheet while the comments sheet paused it.
 */
import { computeExternalOverlayVisible, VideoOverlayFlags } from '@/utils/videoOverlayGate';

const noOverlays: VideoOverlayFlags = {
  liveStreamVisible: false,
  showInterstitialAd: false,
  uploadModalVisible: false,
  searchOverlayVisible: false,
  showAdFeedback: false,
  optionsSheetVisible: false,
};

describe('computeExternalOverlayVisible', () => {
  it('is false when no overlay is visible (feed may play)', () => {
    expect(computeExternalOverlayVisible(noOverlays)).toBe(false);
  });

  it.each(Object.keys(noOverlays) as (keyof VideoOverlayFlags)[])(
    'gates the feed when %s is the only visible overlay',
    (flag) => {
      expect(computeExternalOverlayVisible({ ...noOverlays, [flag]: true })).toBe(true);
    },
  );

  it('stays gated while any one of several overlays remains visible', () => {
    expect(
      computeExternalOverlayVisible({
        ...noOverlays,
        showInterstitialAd: true,
        optionsSheetVisible: true,
      }),
    ).toBe(true);
  });

  it('options sheet alone silences the feed (the previously-missing overlay)', () => {
    expect(
      computeExternalOverlayVisible({ ...noOverlays, optionsSheetVisible: true }),
    ).toBe(true);
  });
});
