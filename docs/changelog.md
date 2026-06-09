# Change & Audit Log

A running, audit-oriented log of substantive changes: **what** changed, **why**,
the **invariants** it establishes, and the **PRs** that delivered it. Newest first.
Add an entry as part of the work, not after.

---

## 2026-06-09 — Question screen UX: test coverage + e2e wiring

Closes the coverage gaps from the Phase 3/4 work and wires the question E2E flow into CI.

- **Phase 3/4 unit assertions added** — `questions-new.ui.test.tsx`: "My Activity" auth
  gating (routes to login when logged out), the "You're all caught up" end-of-list
  marker, K/M count abbreviation + the "Answered" chip from `userHasResponded`. New
  `skeleton-reduced-motion.ui.test.tsx`: the feed skeleton renders in both reduce-motion
  states (the branch that previously had no test).
- **E2E wiring** — moved `questions-smoke.yaml` (feed → detail → answer) into the CI
  `.maestro/` dir and added it to `maestro.yml` (runs after auth, non-gating). Added a
  stable `testID="option-<n>"` to the instant-reward option so `instant-reward.yaml`'s
  `option-0` tap actually selects an answer instead of being a silent no-op.

> Verification: `tsc` 0 errors; full `jest` green (incl. 5 new assertions); `bun test`
> server green; Playwright visual pixel-diff green (question presentational components).

## 2026-06-09 — Question screen UX, Phases 3 & 4: feed polish + a11y (PR #8)

Contained, low-risk items from the feed and accessibility phases.

**Feed (`questions-new.tsx`, `QuestionFeedItem.tsx`):**
- **Abbreviated counts** — vote/answer/follower counts now use the K/M formatter
  (`formatReputation`) so popular questions don't break the layout.
- **Answered badge** — cards show a "✓ Answered" chip from the `userHasResponded`
  seed (Phase 1), so users don't tap into questions they've already answered.
- **"My Activity" gating** — selecting the user-scoped tab while logged out routes to
  login instead of showing an empty/errored anonymous result.
- **End-of-list marker** — "You're all caught up" when there are no more pages, so the
  feed doesn't just stop (which reads as a load hiccup).

**Accessibility (`SkeletonLoaders.tsx`):**
- The production feed skeleton's shimmer now respects the OS **reduce-motion** setting
  (WCAG 2.3.3) — it holds a static skeleton instead of looping. (The timer's
  per-second live-region spam was fixed in the Phase 2 entry above.)

> Deferred (need dedicated work): header declutter (subjective reorder of many ad/CTA
> slots), instant-reward card → specific-question routing (needs a `rewardQuestionId`
> backend field), and the deeper reward-screen cash-flow items listed under Phase 2.

## 2026-06-09 — Question screen UX, Phase 2: timed-reward fairness (PR #8)

Highest-trust-stakes fixes for the timed reward flow.

- **Wall-clock timer.** `QuestionTimer` (used by the instant-reward screen) was a
  `setInterval`-on-state countdown that silently paused when the app was backgrounded
  or the JS thread was starved — handing the user free time and disagreeing with the
  server's real expiry. It now derives `timeLeft` from a fixed **deadline** each tick,
  re-syncs on `AppState` foreground, and fires its expiry/warning haptics **once** even
  if ticks were skipped. Same fix applied to `CompactQuestionTimer`.
- **Timer a11y.** Dropped the per-second `accessibilityLiveRegion="polite"` that made
  screen readers announce "59s, 58s…" every second; the `timer` role + label remain.
- **Option role consistency.** The instant-reward option used
  `accessibilityRole="button"`; switched to `"radio"` (+ `checked` state) to match the
  regular reward screen and the shared component, so single-select semantics are announced.

> **Invariant:** timed countdowns must be deadline-based (wall-clock), never a
> decrement-on-tick, so elapsed real time always counts. Tests:
> `__tests__/ui/question-timer.ui.test.tsx`.

Still pending in this area (deferred for careful, isolated work on the ~1700-line live
payment screens): grace auto-submit at expiry + pause-timer-during-submit, offline-queue
parity on the regular reward screen, wiring the built-but-unused `SpotsStatus`, and
clarifying "earned points" vs "won the cash prize" copy.

## 2026-06-09 — Question screen UX, Phase 1: community Q&A answer screen (PR #8)

First of a four-phase plan to close UX gaps on the question screens. This phase
targets `app/question-answer/[id].tsx` (the community Q&A answer screen) and a small,
contained backend seed.

- **Reward is now communicated.** The submit response already returned `rewardEarned`
  but the screen ignored it; success now surfaces "You earned X points" (banner +
  toast + `announceForAccessibility`).
- **Already-answered shows on load, not just after a failed submit.** Seeded from the
  server's new `userHasResponded` and derived client-side from the user's own response
  in the list. Detection switched from the brittle exact-match error string to a stable
  `code: 'ALREADY_RESPONDED'` (message kept as fallback).
- **No more dead end after submitting** — a "Browse more questions" CTA continues the
  answer-and-earn loop.
- **Load failure vs missing question** are now distinct error states (a flaky-network
  user isn't told the question doesn't exist).
- **A11y:** submitted banner is a polite live region.

> **Invariant:** already-answered detection relies on the server `code`
> (`ALREADY_RESPONDED`) and the seeded `userHasResponded`, not message text. The feed
> seed mirrors the existing `userHasVoted` seeding in `getQuestions`.

Backend: `server/controllers/questionController.mjs` seeds `userHasResponded` in
`getQuestions` and returns the `code` on the 409.
Tests: `__tests__/ui/question-answer.ui.test.tsx` (reward ack, code-based detection,
answered-on-load, next-step) + `server/test/questionResponseCode.test.js`.

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
