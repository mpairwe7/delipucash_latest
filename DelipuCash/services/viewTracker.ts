/**
 * Organic view recorder.
 *
 * Bridges the feed's watch milestone (play_3s) to the server view counter
 * (POST /api/videos/:id/views). Three dedup layers keep the count honest:
 *  1. the caller's one-shot milestone flag (play_3s fires once per activation),
 *  2. this module's per-app-session Set (one network call per video per session),
 *  3. the server's (videoId, viewerKey, kind, UTC day) unique key.
 *
 * Fire-and-forget: a failed send is dropped — views are not billable, and the
 * server-side day-bucket dedup makes any future re-send count at most once.
 */
import { videoApi } from './videoApi';

const recordedThisSession = new Set<string>();

export function recordView(videoId: string): void {
  if (!videoId || recordedThisSession.has(videoId)) return;
  recordedThisSession.add(videoId);
  // incrementView never rejects (fetchJson catches network errors), but guard
  // anyway — a view must never crash the playback path.
  void videoApi.incrementView(videoId).catch(() => {});
}

/** Test-only: clear the session dedup set. */
export function __resetViewTrackerForTests(): void {
  recordedThisSession.clear();
}
