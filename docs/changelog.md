# Change & Audit Log

A running, audit-oriented log of substantive changes: **what** changed, **why**,
the **invariants** it establishes, and the **PRs** that delivered it. Newest first.
Add an entry as part of the work, not after.

---

## 2026-06-11 — Survey remediation, Phase 3: client perf + robustness

- **Typing no longer re-evaluates conditional logic.** `visibleQuestions` depended on
  the whole `answers` map, so every keystroke into ANY question re-filtered all
  questions and re-ran every rule (O(questions×rules) per keystroke). It is now keyed
  on `buildLogicAnswersKey(answers, getLogicSourceIds(questions))` (new pure helpers in
  `utils/conditionalLogic.ts`) — only answers to rule-SOURCE questions can trigger
  evaluation. The existing commit-count perf baseline could not catch this (commits
  stay constant; its fixture has no logic), so a dedicated lock exists:
  `__tests__/perf/survey-logic.perf.test.tsx` spies on `evaluateConditions` and asserts
  ZERO calls while typing into a non-source question.
- **One `JSON.parse` per question.** The four per-type parse helpers in
  `app/survey/[id].tsx` (options/rating/boolean/number) each re-parsed the same
  serialized options (~5 parses per question) — merged into `parseQuestionConfig`,
  semantics preserved per type.
- **Submit migrated off the legacy API layer.** `useSubmitSurvey` now calls
  `surveyApi.submitResponse` (reads already lived in `services/surveyApi.ts`; the
  legacy `services/api.ts` path had drifted — untyped `pointsAwarded`/`cashEquivalent`).
  `SurveySubmissionResult` gained the typed reward fields; retry stays 0.
- **Builder drafts survive corruption.** The persist `migrate` is now the exported pure
  `sanitizePersistedBuilderState`: a structurally invalid draft (non-array questions,
  junk entries — e.g. a truncated AsyncStorage write) used to crash the builder on open
  with no way out short of clearing app data; it now resets to a clean draft, and valid
  drafts still get the v0→v2 migrations. Tests: `__tests__/surveyBuilderStore.test.ts`.
- **File uploads are cancellable.** `uploadSurveyFile` accepts an `AbortSignal`
  (r2UploadService precedent: cancel must abort the actual XHR, not just UI state),
  `useUploadSurveyFile` exposes `cancel()`, and `FileUploadQuestion` shows a Cancel
  button while uploading — previously a stalled large file left the respondent stuck
  (Next is blocked during upload) with no out short of killing the app. Tests:
  `__tests__/surveyFileUpload.abort.test.ts` (pre-aborted short-circuit, mid-flight
  abort, normal completion).

> **Invariant:** keystrokes into non-source questions evaluate zero conditional rules;
> a corrupt builder draft never takes the builder down; an in-flight survey file upload
> can always be aborted client-side. Client suite: 253 pass (38 suites); tsc + lint
> clean.

## 2026-06-11 — Survey remediation, Phase 2: reward honesty (points now, payouts gated)

The audit's headline product finding: respondent-facing UI promised
`survey.rewardAmount` (creator-set, default UGX 2,000) on cards and the attempt screen,
but submission credits only the config-driven `surveyCompletionPoints` (10 pts ≈ UGX 400).
The full MoMo payout pipeline (`processSurveyPayout` + budget rollback) exists but is
UNREACHABLE dead code — and activating it would be worse: `Survey.totalBudget` is a
self-declared number with **no funding/escrow flow**, so payouts would disburse the
PLATFORM's MoMo money against unfunded creator promises.

Decision (maintainer): **honest points now; payout design documented + gated.**

- **Respondent UI now promises what is actually credited.** `SurveyCard` (badge +
  accessibility hint) and the attempt screen (hero pill + submit-modal stat) show
  `+{points} pts (~UGX {pointsToUgx})` from the live reward config
  (`useRewardConfig`/`pointsToUgx`) — never `rewardAmount`. **Owners** keep seeing their
  configured `rewardAmount` (it remains their budget figure). The completion overlay was
  already honest (it shows the actual `pointsAwarded`).
- **Server:** a DORMANT-BY-DESIGN header on the payout pipeline explains why nothing may
  call it until an escrow/funding product exists.
- **Gated activation design** (do NOT build until escrow ships): at-submission atomic
  budget spend (`amountDisbursed` increment guarded by the `totalBudget` ceiling — the
  ads literal-ceiling `updateMany` pattern), persist `amountAwarded` + `paymentStatus:
  PENDING` + phone/provider (`AppUser.phone` → `detectMoMoProvider`), fire
  `processSurveyPayout` async post-commit (retry/backoff + rollback already exist),
  points fallback when the pool is exhausted or no provider matches, a stale-PENDING
  sweeper modeled on `cleanupStalePayments`, and freezing `rewardAmount`/flooring
  `totalBudget` at `amountDisbursed` once responses exist. Activation criteria: an
  escrow/funding flow + a product decision on cash-replaces-points.

> **Invariant:** every reward number a respondent sees is the config-driven amount that
> submission actually credits; `rewardAmount` is creator-facing only; the payout pipeline
> stays uncallable until funded. Tests: `__tests__/ui/survey-components.ui.test.tsx`
> (respondent vs owner labels), `__tests__/ui/survey-take.ui.test.tsx` (hero promises
> config points, never rewardAmount). Client suite: 239 pass.

## 2026-06-11 — Survey remediation, Phase 1: server authz + data integrity

Server half of the survey-screen remediation (from the survey screen + components audit).
Closes an IDOR, a broken delete path, an unenforced response cap, a client-only paywall,
and the bug that made conditional logic dead end-to-end.

- **IDOR closed.** `updateSurvey`'s per-question writes used
  `uploadSurvey.update({ where: { id } })` unscoped to the owned survey — any survey
  owner could tamper with ANY question of ANY other survey by passing foreign ids. Now
  `updateMany({ id, surveyId })`; unknown ids → 400 `UNKNOWN_QUESTION_IDS` and the whole
  update (now one `$transaction`) rolls back. Single-sided date updates validate the
  combined window; question types are validated; `conditionalLogic` is no longer dropped.
- **Structural-edit lock.** Once a survey has responses, question edits return 409
  `EDIT_LOCKED` (answers are keyed by question id + option text — edits silently
  corrupted every existing response and the analytics built on them). Metadata edits
  (title/description/dates/reward/cap) stay allowed; ending early via `endDate` is the
  supported close path.
- **deleteSurvey fixed.** It claimed "cascades handle the rest", but `SurveyResponse`
  has no cascade — deleting any answered survey 500'd on P2003 AFTER already deleting
  the questions (and R2 files). Now: responses exist → 409 `SURVEY_HAS_RESPONSES`
  (respondents' earning records are preserved; end the survey instead); zero-response
  deletes run questions+survey in one `$transaction` with R2 cleanup AFTER the commit;
  P2003 race backstop → 409.
- **maxResponses enforced (atomically).** It was never checked — capped surveys accepted
  unlimited responses. New denormalized `Survey.responsesSubmitted` (migration
  `20260611090000_survey_response_guard`, COUNT-backfilled) + the ads atomic-spend
  pattern: cap condition + increment in ONE `updateMany` inside the submission
  transaction; cap reached → 410 `SURVEY_FULL`; a duplicate-attempt rollback undoes the
  increment too.
- **Server-side paywall.** `/create` + `/upload` accepted any authenticated user — the
  subscription gate was client-only. New `utils/surveyAccess.mjs#requireSurveyCreatorAccess`
  (ADMIN/MODERATOR bypass, `surveysubscriptionStatus`/legacy `subscriptionStatus`
  ACTIVE, or unexpired SUCCESSFUL MoMo SURVEY payment — mirrors
  `getUnifiedSubscriptionStatus`) → 403 `SUBSCRIPTION_REQUIRED`.
- **uploadSurvey finally validates** (it validated nothing): title/questions/text
  presence, dates, canonical types, conditional-logic references; creation is atomic
  (survey + questions in one transaction — no more empty surveys on partial failure).
- **Conditional logic resurrected.** The builder references questions by client-side ids
  (`q_<ts>_<n>`) inside rules; the server minted fresh UUIDs and stored the rules
  untouched — `rule.sourceQuestionId` never matched at attempt time, so every
  app-created rule was dead (an `equals` show-rule hid its question forever; the
  server's symmetric submit-time check masked it). The client now sends `clientId` per
  question (`SurveyForm.tsx`); the server validates references (new
  `lib/surveyConditionalLogic.mjs`, an ESM port of the client validator) and remaps
  every rule onto the created UUIDs inside the creation transaction.
- **Type vocabulary unified.** `createSurvey`'s whitelist rejected the app's real types
  (`radio`/`paragraph`/`number`/`boolean`) and accepted unrenderable ones
  (`multiple_choice`/`textarea`/`nps`/`slider`) — an unknown required type bricks the
  attempt (renderer default-cases to text, `isAnswerValid` returns false → Next disabled
  forever). New `lib/surveyQuestionTypes.mjs`: canonical list = renderer vocabulary;
  legacy aliases normalize (`multiple_choice→radio`, `textarea→paragraph`,
  `nps/slider→rating`). Applied to create/upload/update.
- **Rate limits** (`utils/surveyRateLimit.mjs`): submission 30/min/IP, creation
  30/hour/IP. **PII logs** of full question payloads removed (ids/counts only).

> **Invariant:** survey mutations require ownership; question writes are scoped to the
> owned survey; a survey with responses can be ended but never structurally edited or
> deleted; a survey accepts at most `maxResponses` responses (atomic guard); creation
> requires an active survey subscription, validates the renderer type vocabulary, and
> remaps conditional-logic ids so rules reference real questions. Tests:
> `server/test/surveySecurity.test.js`, `surveyUpload.test.js`, `surveyIntegrity.test.js`
> (+ `surveySubmit.test.js` extended). Server suite: 109 pass.

## 2026-06-10 — Infra: production DB moved Supabase → Neon; deploy workflow refit to migrate-only

The production Supabase project (`awvfsqlizoynsvqycegr`) became unreachable (pooler:
"tenant not found"; `db.<ref>.supabase.co` NXDOMAIN — paused/deleted), taking down every
DB-backed endpoint. Replaced with **Neon** (provisioned via `neonctl`):

- New project `delipucash` (`gentle-rice-07431009`), Postgres 17, `aws-ap-southeast-1`
  (same region as the old Supabase). **All 17 migrations applied** to the default `main`
  branch — including `20260610150000_video_view_events`, closing the view-count task.
- New **`development` branch** (`br-gentle-truth-aokmiory`) created off the migrated
  `main` — inherits schema + migration history. Topology: Vercel **production env →
  `main`** (pooled URL + `pgbouncer=true` as `DATABASE_URL`, direct URL as
  `DIRECT_DATABASE_URL`); **local `server/.env` → `development`** (old Supabase values
  backed up to gitignored `.env.bak-supabase-20260610`). `channel_binding` is stripped
  from Neon's URLs (Prisma's parser rejects it).
- Vercel env updated via the REST API (`vercel env add` silently stores EMPTY when the
  value is piped to non-TTY stdin — caught by the migrate step's own guard).
- **Deploy workflow refit (this PR):** dropped `vercel build` + `vercel deploy
  --prebuilt` — they raced Vercel's Git integration (which auto-deploys every main push
  and has been the real deploy path all along) and broke under the Bun-installed CLI
  (`spawn sh ENOENT`). The workflow is now the schema guard: validate → pull env →
  `prisma migrate deploy` → post-apply `migrate status`. One deploy path (Git
  integration), one migration path (this workflow).

> **Invariant:** migrations are applied by exactly one automated path, from the verified
> Vercel production env, with DB URLs crossing only files/env (never argv/logs); the
> deploy/migration race is bounded by keeping migrations additive. **Old-DB data was not
> migrated** — if the Supabase project is ever restored, export/import is still possible.

## 2026-06-10 — CI: deploy workflow applies Prisma migrations (and survives install)

The `Deploy Server` workflow had failed at **Install dependencies** on every main push
since 2026-06-08: `postinstall` runs `prisma generate`, which loads `prisma.config.ts`
and resolves `env('DIRECT_DATABASE_URL')` at install time — Prisma's `env()` throws on a
missing var. (The CI `server-test` job had the same problem and already carried the fix;
the deploy job never got it.) Real deploys were silently happening only via Vercel's Git
integration, which runs no migrations — which is how the `VideoViewEvent` migration
(Phases 1–2) ended up unapplied in production.

- Install + Validate steps get placeholder `DATABASE_URL`/`DIRECT_DATABASE_URL`
  (generate/validate never connect — mirrors `ci.yml`'s documented fix).
- New **Apply database migrations** step (PR #14): after `vercel pull`, extracts the real
  `DIRECT_DATABASE_URL`/`DATABASE_URL` from the pulled production env (grep/cut — the
  file is never sourced, values never echoed) and runs `prisma migrate deploy` BEFORE
  building/promoting. A migration failure blocks the promotion by design.

> **Invariant:** code is never promoted against an unmigrated schema; the deploy job can
> install without database credentials; DB URLs cross the workflow only via files and
> env, never argv/logs. Refs #14.

Operational note: at the time of this change the production Supabase project
(`awvfsqlizoynsvqycegr`) is unreachable (paused/deleted — pooler reports tenant not
found; `db.<ref>.supabase.co` does not resolve). The migrate step will fail until the
project is restored, blocking workflow deploys — Vercel Git-integration deploys continue.

## 2026-06-10 — Server: production outage fix — remove @sentry/profiling-node

Every production request was failing with `FUNCTION_INVOCATION_FAILED` (root, `/api/health`,
all API routes). Runtime logs: `Cannot find module '.../@sentry/profiling-node/lib/
sentry_cpu_profiler-linux-x64-glibc-137.node'` — `lib/sentry.mjs` top-level-imported
`@sentry/profiling-node`, which loads a prebuilt native binary keyed to the Node ABI.
`server/package.json#engines` pins only bun, so when Vercel bumped the function runtime to
Node 24 (ABI 137, no prebuilt in 8.47.x) the import crashed at module load — a total outage
for a nice-to-have CPU profiler. The outage predated and was unrelated to the video
remediation merges (older deployments crash identically).

- Removed the dependency + `nodeProfilingIntegration()` from `Sentry.init` (error
  reporting, tracing, and the PII-stripping `beforeSend` are unchanged — none need the
  native module). A header note in `lib/sentry.mjs` documents why it must not return.
- Alternative considered: pinning `engines.node = 22.x`. Rejected — keeps a fragile
  native-ABI dependency on a serverless platform for marginal profiling value.

> **Invariant:** the server has no native-binary runtime dependency tied to the Node ABI;
> a Vercel Node-version bump cannot take production down at module load. Verified:
> `bun -e "await import('./lib/sentry.mjs')"` loads clean; full server suite 77 pass.

## 2026-06-10 — Video remediation, Phase 5: UX honesty + polish

Final phase of the video-screen remediation. Removes controls that did nothing and
closes the remaining consistency gaps.

- **Removed fake controls** (decision with maintainer: remove, not "coming soon").
  In the full-screen `VideoPlayer`: the quality menu (Auto/1080p/… set local state
  only — R2 stores a single MP4, no renditions), the auto-captions toggles + CC badge
  (no captions pipeline or rendering), the silence-skip toggle + badge (state-only),
  the always-"Auto" adaptive-bitrate badge (never updated), and the gift button (no
  `onPress` at all). In `VideoFeedItem`: the caption button (no handler). Playback
  speed stays — it's real (`player.playbackRate`). A header note in `VideoPlayer.tsx`
  documents the rule: re-add each control only when its backing capability ships.
- **Options sheet now silences the feed.** The overlay union gained
  `optionsSheetVisible` — it was the only overlay missing, so feed audio kept playing
  under the report/block sheet while the comments sheet paused it. The union now
  lives in a pure helper `utils/videoOverlayGate.ts#computeExternalOverlayVisible`
  (project rule: every new overlay on the video screen registers there).
- **Thumbnails via expo-image** (`VideoFeedItem`): `cachePolicy="memory-disk"`,
  `recyclingKey={video.id}` (no stale-frame flash on FlatList recycling), neutral
  near-black blurhash placeholder + 150ms transition. Per-video blurhashes deferred
  (needs an upload-pipeline field).
- **Single source of truth for likes.** Removed `VideoStore`'s duplicate persisted
  `likedVideoIds`/`toggleLikeVideo`/`isVideoLiked` (zero render consumers — verified;
  `VideoFeedStore` is canonical and is what `videos-new` and `video/[id]` use). The
  orphaned persisted copy is simply dropped on next rehydrate.

> **Invariant:** every control on the video screen does what it claims; any overlay
> covering the feed silences it (union unit-tested); liked-video state has exactly one
> store. Tests: `__tests__/videoOverlayGate.test.ts` (each overlay gates the feed,
> incl. the previously-missing options sheet); full suite + tsc green; lint warnings
> reduced (removed dead imports).

## 2026-06-10 — Video remediation, Phase 4: real source-load window + network awareness

Playback/perf phase. The audit found the feed's "preloading" was **bookkeeping-only**
(`markPreloaded` was called speculatively while every mounted item attached its source
immediately — with `windowSize: 5` that's ~5 native players buffering uncontrolled), and
data saver only deferred autoplay, not loading.

- **Honest load window.** New pure helper `utils/videoPreload.ts#computeShouldLoad`:
  active item always loads; default window 2 ahead / 1 behind (the store's long-standing
  preload constants); manual data saver = active only; auto cellular trim = 1 ahead / 0
  behind. `VerticalVideoFeed` passes `shouldLoad` per item.
- **Sourceless players outside the window.** `VideoFeedItem` now creates its player with
  a `null` source; a load-window effect attaches `replaceAsync(videoSource)` on entry and
  releases (`replaceAsync(null)`) on exit — mounted-but-distant items hold no buffers.
  **Data saver now actually prevents neighbor loading.**
- **Truthful preload bookkeeping.** The speculative `markPreloaded` loop in
  `VerticalVideoFeed` is gone; `VideoFeedItem` reports `markPreloaded` from the player's
  real `readyToPlay` event and `markPreloadFailed` from `error`.
- **Network awareness.** New persisted `autoDataSaverOnCellular` setting (default ON,
  toggle in `QuickSettingsSheet`): on cellular, the load window narrows — autoplay is
  untouched (softer than manual saver). Error recovery checks `NetInfo.fetch()` first:
  offline → error UI immediately instead of the backoff + URL-refresh loop against a dead
  network; retries are also gated on the item still being in the load window.
- jest setup now uses NetInfo's official mock (the real module dereferences a native
  interface at import time under jest).

> **Invariant:** at most `1 (active) + ahead + behind` items hold a loaded source —
> 4 on Wi-Fi, 2 on cellular (auto), 1 in data saver; `preload.preloadedIds` reflects
> only sources a player actually reported ready. Tests:
> `__tests__/videoPreloadWindow.test.ts` (window edges, saver, trim, cold start,
> overrides); full suite + tsc + lint green.

Risk noted for device verification before merge: `replaceAsync` churn on fast Android
flings (the feed's scroll-speed classifier exists if dampening is needed); blank-frame on
release is mitigated by the thumbnail crossfade on `!isActive`.

## 2026-06-10 — Video remediation, Phase 3: wire organic view recording

Client half of the view-integrity fix. The audit found a **dead view pipeline**: no
screen or component ever called the view endpoint, so organic feed watching never
incremented `Video.views` — Trending's `views >= MIN_TRENDING_VIEWS (10)` gate was
unreachable organically, and `completionRate = completions/views` was corrupted
(completions WERE wired; views weren't).

- New `services/viewTracker.ts` — `recordView(videoId)`: module-level per-app-session
  `Set` dedup + fire-and-forget send. Wired into `VideoFeedItem`'s one-shot `play_3s`
  telemetry milestone — the single organic-watch path for every feed tab (For You /
  Following / Trending all render `VideoFeedItem`). Sponsored (`ad-*`) synthetic
  entries are skipped — they aren't Video rows and have their own impression tracking.
- `videoApi.incrementView` / `videoApi.recordCompletion` now POST
  `{ sessionId: telemetry.getSessionId() }` and attach the Bearer token, so the
  server dedup key (Phases 1–2) prefers the verified user and falls back to the
  telemetry session — views become cross-checkable against `play_3s` events.
- Legacy `services/hooks.ts#useIncrementVideoView` marked `@deprecated` (no dedup, no
  sessionId, zero consumers); `useRecordVideoView` keeps its API and inherits the
  carriers via `videoApi`.

> **Invariant:** watching a feed video for 3 seconds records exactly one view per app
> session client-side and at most one per viewer per UTC day server-side; trending
> eligibility is now reachable organically. Tests: `__tests__/videoViewTracker.test.ts`
> (session dedup, fire-and-forget), `__tests__/videoApi.endpoints.test.ts`
> (sessionId + token carriers, anonymous path, tolerant parsing intact).

Deferred: deep-linked detail flows (`VideoPlayer` modal is only reachable from the feed,
which already recorded the view); offline view queue (views aren't billable — the
server-side day-bucket dedup makes any future replay safe).

## 2026-06-10 — Video remediation, Phases 1–2: server authz + view-count integrity

Server half of the video-screen remediation (from the video screen + components audit).
Closes two critical authorization holes and makes the engagement counters trustworthy.

- **Ownership enforced.** `updateVideo` / `deleteVideo` accepted ANY authenticated user
  (`verifyToken` only — no owner check), so anyone could rewrite or delete anyone's
  video. Both now authorize via `loadOwnedVideo` (owner or ADMIN/MODERATOR — the
  `loadOwnedAd` pattern). Update is field-whitelisted to `{ title, description }`;
  `videoUrl` is R2-derived and no longer rewritable through the API.
- **Delete is transactional + cleans storage.** `Comment` has no DB cascade, so comments
  + video now delete in one `$transaction` (a crash between the two can no longer leave
  a half-deleted video); the video/thumbnail R2 objects are best-effort deleted after
  commit — storage no longer leaks, and an R2 failure never fails the request.
- **Views/completions deduped + rate-limited.** `POST /:id/views` and `/:id/completion`
  were public, unauthenticated, and blindly incremented — bot-inflatable counters that
  feed the trending score. New `VideoViewEvent` table (migration
  `20260610150000_video_view_events`) with unique `(videoId, viewerKey, kind, dayBucket)`;
  the counter increments only when the event row inserts (duplicate → idempotent no-op).
  `viewerKey` = verified token user, else client sessionId, else an ip+ua hash — never a
  body-supplied user id. The routes get `optionalAuth` + a 60/min/IP rate limit
  (`videoTrackingRateLimit`, cloned from the ads limiter); `/events` telemetry is
  rate-limited too and clamps sessionId (128 chars) / payload (~2KB).
- The views response is slimmed to `{ success, views }` — it was re-signing R2 URLs and
  returning the full video object on a fire-and-forget hot path.
- `commentPost` now enforces the 500-char cap server-side, bounds media to 4 http(s)
  URLs (≤2048 chars each), and no longer logs request bodies.

> **Invariant:** only the owner (or admin/moderator) can update/delete a video; update is
> field-whitelisted; delete is atomic and cleans R2; a viewer counts at most one view and
> one completion per video per UTC day; attribution comes from the verified token, never
> the body. Tests: `server/test/videoSecurity.test.js`,
> `server/test/videoIntegrity.test.js`.

Known follow-up (next PR): the client never calls the views endpoint — organic watches
don't count, so Trending's `views >= 10` gate is unreachable organically. The follow-up
PR (#16, Phase 3) wires `recordView` into the feed's `play_3s` milestone, carrying the
telemetry sessionId.

## 2026-06-10 — Ads: offline event queue (Phase 3 follow-up)

Closes the deferred follow-up from the client tracking PR. Ad impression/click tracking
was fire-and-forget, so a failed send (offline / flaky network) lost a billable event.

- New `store/AdEventQueueStore.ts` — a persisted (AsyncStorage) queue of failed events,
  deduped by `eventId` and capped at 200.
- `useRecordAdImpression` / `useRecordAdClick` now enqueue the event when the server send
  fails (instead of dropping it).
- New `hooks/useAdEventQueueProcessor.ts` (mounted in `_layout.tsx` beside
  `useOfflineQueueProcessor`) replays the queue when connectivity returns (`onlineManager`)
  and once on mount; an event that keeps failing is discarded after 3 retries.

> **Invariant:** replays are idempotent — each event carries its `eventId`, which the
> server (Phase 2) dedups on, so a re-send counts at most once. Tests:
> `__tests__/adEventQueue.test.tsx` (dedup, replay, retry, discard, offline no-op).

## 2026-06-10 — Ads remediation, Phases 3–4: client tracking integrity + transparency

Client half of the ads remediation (complements the server security/integrity PR).

- **Impression double-fire fixed.** `useAdImpressionTracker` fired in BOTH the invisible
  branch and the effect cleanup, so scrolling an ad out of view **double-counted** it (and
  the cleanup re-ran on every dependency change, risking mid-view fires). It now records
  **exactly one** impression per view (visible→invisible, or unmount-while-visible) via a
  `firedRef` guard + a separate unmount-only effect.
- **Idempotency keys.** Impression/click payloads now carry an `eventId` (generated per
  event); the server dedups duplicate `eventId`s, so a retry / offline re-send counts at
  most once.
- **Measured viewability.** `useAdImpressionTracker` accepts a `viewportPercentage`
  (defaults to 100 when not measured) instead of always hardcoding 100.
- **Transparency.** `AdComponent` no longer falls back to an unrelated Unsplash stock photo
  when an ad has no usable media — it clears the thumbnail so the card shows its real
  "Image unavailable" placeholder. (The `SponsoredBadge` already labels ads for a11y.)

> **Invariant:** one server impression per ad view; impression/click are idempotent by
> `eventId`. Tests: `__tests__/ui/adImpressionTracker.test.tsx`. tsc + lint clean.

Deferred follow-up: a **persisted offline queue** that re-sends failed impression/click
events on reconnect (the `eventId` foundation for safe retries is now in place; tracking is
still fire-and-forget, so events can be lost while offline).

## 2026-06-10 — Ads remediation, Phase 2: revenue integrity (events, dedup, date-window)

Builds on Phase 1. Restores trustworthy billing and an audit trail.

- **Event tables + idempotency.** New `AdImpression` / `AdClick` models (unique `eventId`
  + `(adId,createdAt)`/`(userId,createdAt)` indexes). Tracking now logs a **deduped event
  row AND increments the counter in one transaction** — a duplicate `eventId` (client
  retry) counts once, and the rows provide an audit trail + fraud signals (userId taken
  from the **verified token**, never the body; device/session/ip/ua + viewability).
- **Date-window serving.** `getAllAds` is filtered to active+approved **and within the
  start/end window**; new composite indexes `(isActive,status,placement,priority)` and
  `(startDate,endDate)`.
- **Daily budget.** Added `dailySpend`/`dailySpendDate`; `dailyBudgetLimit` is now enforced
  (HTTP 429 when the day's spend + cost would exceed it, with a UTC-day reset). Total
  budget remains the atomic guard from Phase 1.
- **Bug fix.** `getAllAds` still referenced the Phase-1-removed `status` query var in its
  cache key — it would have 500'd the public feed on every call. Corrected.

Migration `prisma/migrations/20260610120000_ads_event_tables` was generated **offline**
(`prisma migrate diff` schema-to-schema — no live DB touched); apply with
`prisma migrate deploy` in a controlled environment.

> **Invariant:** an impression/click is counted at most once per `eventId` (idempotent),
> logged with token-derived attribution, and served only within its date window. Tests:
> `server/test/adIntegrity.test.js`. Full server suite: 58 pass.

## 2026-06-10 — Ads remediation, Phase 1: P0 server security

An audit of the ads system (custom server-driven; no AdMob) found critical server-side
holes. This phase closes the actively-exploitable ones; integrity (event tables/dedup)
and client tracking follow in later phases.

- **Atomic budget + servable guard on tracking.** `trackAdImpression/Click/Conversion`
  did a non-atomic check-then-update, so concurrent requests could overspend `totalBudget`,
  and they charged budget for *any* existing ad (even paused/expired/unapproved). Replaced
  with a single conditional `updateMany` whose WHERE carries the budget ceiling
  (`amountSpent <= totalBudget - cost`) **and** active/approved/in-window conditions — one
  statement, race-safe, never spends on a non-servable ad. `trackAdView` likewise only
  counts for a live ad.
- **Abuse protection on the (still public) tracking routes.** Added a per-IP rate limiter
  (`utils/adRateLimit.mjs`, 60/min) + `softAuth` (attribute to a real user when a token is
  present; anonymous still allowed) on `/view`,`/impression`,`/click`,`/conversion`.
- **Ownership/role scope on management.** `updateAd`/`deleteAd`/`pauseAd`/`resumeAd` now
  require the caller to own the ad (or be ADMIN/MODERATOR) via a shared `loadOwnedAd`
  helper. `updateAd` also **whitelists** campaign fields — an owner can no longer set
  `status:'approved'` (bypass moderation), reset `amountSpent`, or touch counters.
- **Public feed lock.** `getAllAds` no longer honors the `status`/`isActive` query
  override (it could leak `?status=pending` ads, and the param-keyed cache could serve a
  cached admin response to anonymous callers). It is hard-locked to active + approved.

> **Invariant:** budget is spent only via the atomic `recordBillableEvent` guard
> (servable + within-budget in one `updateMany`); ad mutations require ownership; the
> public `/all` endpoint is approved-only. Tests: `server/test/adSecurity.test.js`.

## 2026-06-09 — Question screen UX: test coverage + e2e wiring

Closes the coverage gaps from the Phase 3/4 work and wires the question E2E flow into CI.

- **Phase 3/4 unit assertions added** — `questions-new.ui.test.tsx`: "My Activity" auth
  gating (routes to login when logged out), the "You're all caught up" end-of-list
  marker, K/M count abbreviation + the "Answered" chip from `userHasResponded`. New
  `skeleton-reduced-motion.ui.test.tsx`: the feed skeleton renders in both reduce-motion
  states (the branch that previously had no test).
- **E2E wiring** — moved `questions-smoke.yaml` (feed → detail → answer) into the CI
  `.maestro/` dir. Added a stable `testID="option-<n>"` to the instant-reward option so
  `instant-reward.yaml`'s `option-0` tap actually selects an answer instead of being a
  silent no-op.
- **Switched the Maestro job to Maestro Cloud.** The GitHub-Actions Android emulator
  never booted on the Apple-Silicon macOS runner ("Timeout waiting for emulator to
  boot") — the build itself now completes (timeout fix), but the emulator is a dead end.
  `maestro.yml` now builds the debug APK on cheap `ubuntu-latest` and uploads it + the
  `.maestro` flows to **Maestro Cloud** (hosted real devices) via
  `mobile-dev-inc/action-maestro-cloud`, keyed by the `MAESTRO_API_TOKEN` secret.

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
