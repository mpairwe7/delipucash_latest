# Change & Audit Log

A running, audit-oriented log of substantive changes: **what** changed, **why**,
the **invariants** it establishes, and the **PRs** that delivered it. Newest first.
Add an entry as part of the work, not after.

---

## 2026-06-08 — Video screen hardening, survey fixes, CI/CD cleanup

Branch base for this batch: `test/question-screens-regression` → merged to `main`
via PR #1. Each item was typechecked (`tsc --noEmit` → 0 errors), unit-tested, and
linted before merge.

### Video screen — correctness, lifecycle & robustness (PR #2)

Worked in four phases plus an upload-cancellation fix; **25 regression tests** added.

**Phase 1 — playback ownership & audio.** `isPlaybackAllowed` is now the single
source of truth for feed playback, gated on the full player, mini player, comments,
and a new `isExternalOverlayVisible` flag. All full-screen overlays that own a
player (livestream, interstitial ad, upload, search) are wired into
`setExternalOverlayVisible`, so only one player produces audio at a time. A
`userPausedRef` stops a late `readyToPlay` from overriding a manual pause.
> **Invariant:** any new full-screen overlay that plays audio or covers the feed
> MUST call `store.setExternalOverlayVisible(true/false)`. Do not rely on
> `pauseAllPlayback()` alone — it only sets `activeVideo.status`, which feed items
> don't read. Tests: `__tests__/VideoFeedStore.playback.test.ts`.

**Phase 2 — optimistic state desync.** Shape-aware cache updater (infinite feeds +
flat arrays + detail) with snapshot rollback and a negative-count guard for
like/bookmark; shape-safe comment add/delete (no longer corrupts the infinite cache);
`CreatorAvatarButton` fires the follow mutation immediately (dropped a 600 ms defer
that lost follows on feed recycle); consistent like/count sources across
`VideoActions`, `VideoCommentsSheet`, `FollowButton`, deep-link screen.
> Tests: `__tests__/videoHooks.optimistic.test.ts`.

**Phase 3 — timers, effects & ad impressions.** Ad skip countdown derived from the
video clock (removed interval churn) + no double-fired completion; `VideoFeedItem`
managed/cleared one-shot timeouts + short-video end guard; `EnhancedMiniPlayer`
clears timers, `cancelAnimation` on unmount, animate-then-close on gesture dismiss;
`VideoPlayer` dropped `playbackState` from the event-effect deps (no listener/interval
churn, no stale closure); `VideoPlayerOverlay` guarded against NaN/undefined crashes.

**Phase 4 — feed integrity & API robustness.** Dedupe blended feed by id;
`removeClippedSubviews` off on Android (black-frame/ghost-audio fix); preserve
preload state across feed re-renders; `fetchJson` parses defensively (204/empty/HTML);
follow/block fetches wrapped against throws; auth tokens added to
recommended/byUser/search/comments; `getByUser` pagination derivation;
`incrementView` tolerant parsing; `formatFileSize` guards NaN/negative.
> Tests: `__tests__/videoFeed.phase4.test.ts`.

**Upload cancellation.** An `AbortSignal` is threaded through the R2 upload
service/hooks; cancelling/closing the upload modal now calls `xhr.abort()` instead
of only mutating store state (which left the upload running and able to finalize
server-side).
> Tests: `__tests__/r2Upload.abort.test.ts`.

### Survey-taking flow — correctness (PR #3)

- Option `id` is the option **text** (not a synthetic `opt_N` index) — the text is
  what's stored/submitted and what conditional-logic rules and analytics compare
  against; an index broke text-based branching and showed `opt_0` in exports.
- Store question count synced to the **visible** set via `setTotalQuestions` so
  navigation clamps to reachable questions (conditional logic hides/shows them).
- Block navigation while a file is uploading (answer is only recorded on success);
  25 MB client-side cap; draft-restored files deletable via `currentFileId` fallback.
- `useSubmitSurvey` uses `retry: 0` — the submit POST is non-idempotent and the
  server enforces one attempt per user.
> Tests: `__tests__/SurveyAttemptStore.test.ts`,
> `__tests__/ui/file-upload-question.ui.test.tsx`, `__tests__/useSubmitSurvey.test.tsx`,
> `server/test/surveySubmit.test.js`.

### Video frontend endpoint regression suite (PR #6)

`services/videoApi.ts` had no direct coverage. Added **26 tests**
(`__tests__/videoApi.endpoints.test.ts`) covering defensive `fetchJson` parsing,
auth-token attachment, like/unlike/bookmark + URL normalization, `getById`
unwrap/not-found, `getByUser` pagination derivation, `incrementView` tolerant
parsing, follow/block error handling, and unplayable-video filtering. Full video
suite: **9 suites / 65 tests green.**

### CI/CD (PRs #4, #5)

- **Maestro smoke** was cancelled every run at the 30 min job limit. Fixes: Gradle
  caching (`gradle/actions/setup-gradle@v4`), job `timeout-minutes` 30 → 60, a 45 min
  build step timeout, `arch: arm64-v8a` (macos-latest runners are Apple Silicon — an
  `x86_64` image never boots), and `checkout`/`setup-java` bumped to v5 (Node 24, the
  v4 actions are deprecated as of 2026-06-16). End-to-end emulator validation was
  still pending at time of writing (the build-timeout had to be relaxed first).
- **Netlify removed from CI/CD.** DelipuCash is Expo (mobile) + Node server — no web
  app for Netlify to build, and two connected sites posted failing/irrelevant
  `deploy-preview` checks. Added `netlify.toml` whose `ignore = "/bin/true"` cancels
  every Netlify build (verified: failing checks flipped to "canceled"/"skipped").
  Fully detaching the Netlify GitHub App still needs Netlify/GitHub-App admin access
  (documented in `netlify.toml`).

### Notes for future audits

- `main` was **not** branch-protected at this time — no required checks; failing
  non-required checks (Netlify, Maestro) did not block merges.
- CodeRabbit reviews on PR #1 were largely already addressed; the one "critical"
  server `req.query.userId` comment was a deliberate **skip** (the `/api/questions/all`
  route is intentionally unauthenticated — `req.user` doesn't exist there).
  Later PRs' CodeRabbit reviews were **rate-limited / out of org credits**.
