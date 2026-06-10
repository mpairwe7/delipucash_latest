/**
 * Single-audio rule — the union of overlays that must silence the video feed.
 *
 * Any overlay that covers the feed (or owns its own player/audio) must gate
 * feed playback via VideoFeedStore.setExternalOverlayVisible. Keeping the
 * union as a pure function makes the rule unit-testable and gives new
 * overlays one obvious place to register (project rule: every new overlay on
 * the video screen routes through this).
 */
export interface VideoOverlayFlags {
  /** Live stream / record screen (owns the camera + its own audio) */
  liveStreamVisible: boolean;
  /** Full-screen interstitial ad (plays its own audio) */
  showInterstitialAd: boolean;
  /** Upload modal (covers the feed) */
  uploadModalVisible: boolean;
  /** Search overlay (covers the feed) */
  searchOverlayVisible: boolean;
  /** "Why this ad?" feedback sheet */
  showAdFeedback: boolean;
  /** Video options sheet (Not interested / Hide / Block / Report) — silent
   *  itself, but feed audio under a moderation sheet is jarring and
   *  inconsistent with the comments sheet, which already pauses the feed. */
  optionsSheetVisible: boolean;
}

export function computeExternalOverlayVisible(flags: VideoOverlayFlags): boolean {
  return (
    flags.liveStreamVisible ||
    flags.showInterstitialAd ||
    flags.uploadModalVisible ||
    flags.searchOverlayVisible ||
    flags.showAdFeedback ||
    flags.optionsSheetVisible
  );
}
