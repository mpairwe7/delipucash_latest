# Changelog

Dated audit trail of substantive change sets: what changed, why, the invariants it
establishes, and the tests that lock it in.

## 2026-06-11 — Server dependency security audit (72 Dependabot alerts → 0)

**Scope:** `server/package.json`, `server/bun.lock`, `server/package-lock.json`.
No source files changed. Branch `chore/server-dep-audit` — PR pending.

### Context

GitHub reported 72 open Dependabot alerts (1 critical, 24 high, 41 medium, 6 low),
**all** in `server/package-lock.json`; the mobile app had zero. Triage facts that
shaped the fix:

- Production truth is **`bun.lock`** — CI (`ci.yml`), the Deploy Server workflow, and
  Vercel (`installCommand: bun install`) all install from it. `package-lock.json` is a
  parallel npm lockfile that only Dependabot scans, and it had drifted (e.g.
  `express-rate-limit`/`ip-address` were already patched in `bun.lock` but stale in
  the npm lock).
- The lone **critical** (`fast-xml-parser` 5.3.4, GHSA range `>=5.0.0 <5.3.5`) was a
  runtime dep via `@aws-sdk/xml-builder`, which pins fxp exactly — only an AWS SDK
  bump moves it.
- All 22 `hono` alerts plus `effect`/`lodash`/`defu` were **development-scope** via
  the Prisma 7 toolchain (`@prisma/dev`, `@prisma/config`, `chevrotain`) — not
  shipped to production, but exact-pinned so they needed `overrides`.

### What changed

Direct bumps (runtime) — listed as `package.json` range → lockfile-resolved
version (the ranges are minimum *patched floors*; both lockfiles in this change
pin the resolutions): `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
^3.990.0 → ^3.1066.0, resolving 3.1066.0 (drags fast-xml-parser 5.3.4 → 5.7.3,
kills the critical); `axios` ^1.13.5 → ^1.16.0, resolving 1.17.0 (23 alerts);
`nodemailer` ^6.10.1 → ^8.0.5, resolving 8.0.11 (single `createTransport` SMTP
call site — API unchanged); `multer` ^2.0.2 → ^2.1.1, resolving 2.1.1;
`express-rate-limit` ^8.2.1 → ^8.2.2, resolving 8.5.2; `uuid` ^9.0.1 → ^11.1.1,
resolving 11.1.1 (two `v4` import sites — API unchanged; deliberately not 14.x).

New `overrides` block (security floors for transitives whose parents pin exact or
lag): `hono` ^4.12.7, `@hono/node-server` ^1.19.13, `effect` ^3.20.0, `lodash`
^4.18.0, `qs` ^6.15.2, `path-to-regexp` ^0.1.13, `defu` ^6.1.5. Each override
target has a single consumer-range in the tree (verified), so no cross-package
conflicts. Both lockfiles regenerated and now agree on every resolution.

### Invariants established

- `npm audit`: **0 vulnerabilities** (was 72 alerts).
- `bun.lock` and `package-lock.json` resolve identical versions for every
  previously-flagged package — Dependabot now scans what production runs.
- Prisma toolchain unchanged (`prisma`/`@prisma/client`/`@prisma/adapter-pg` stay
  pinned 7.4.0); `prisma generate` verified working under the `effect` override.

### Verification

`bun test`: 137/137 green at baseline, after the runtime phase, and after the
overrides phase. `prisma generate` exercised (loads `@prisma/config` → `effect`).
`uuid` v4 import smoke-tested. Note: `server`'s `lint` script is pre-existing
broken (`eslint` is not a server devDependency) — out of scope here.

## 2026-06-11 — CI: fix always-failing Maestro + Vercel preview checks

**Scope:** `.github/workflows/maestro.yml`, `server/vercel.json`. Branch
`ci/fix-maestro-vercel-checks`. Neither check is required by branch protection,
but both showed a red ✗ on every PR, training people to ignore CI.

1. **Maestro E2E** died after the ~25-minute APK build with
   `Input required and not supplied: project-id` — the pinned
   `action-maestro-cloud` requires a `project-id` input the workflow never
   passed. Wired `project-id: ${{ secrets.MAESTRO_PROJECT_ID }}` into the upload
   step and added a preflight step that fails in seconds with an actionable
   message when either Maestro secret is missing (instead of wasting the build).
   ACTION REQUIRED: add the `MAESTRO_PROJECT_ID` repo secret (value from
   console.mobile.dev → project settings) to turn the check green.
2. **Vercel (server) preview deploys** errored in 4–6s on every PR while
   production deploys succeed in ~40s: `vercel-build` runs `prisma generate`,
   whose `prisma.config.ts` throws on missing `DIRECT_DATABASE_URL`, and the
   DB env vars exist only in the Production environment. Server previews were
   never functional (deploy model is production-on-main via the Deploy Server
   workflow + Git integration), so previews are now skipped via
   `ignoreCommand: test "$VERCEL_ENV" != "production"` (exit 0 skips the build,
   exit 1 proceeds — verified both branches). Alternative, if functional
   preview servers are ever wanted: add Preview-scoped `DATABASE_URL` /
   `DIRECT_DATABASE_URL` pointing at the Neon development branch and drop the
   ignoreCommand.

**Invariants:** Maestro misconfiguration fails fast with instructions, never
after the build; Vercel builds the server only for production.

## 2026-06-11 — Home screen (dashboard) gap fixes

**Scope:** `app/(tabs)/home-redesigned.tsx` (the live Home tab; `index.tsx` is hidden
via `href: null`). Analysis pass to close UX/correctness gaps on an otherwise
well-built screen. Working-tree change set — PR pending.

### What changed & why

1. **Repurposed dead scroll machinery into a scroll-to-top FAB.**
   The `useAnimatedScrollHandler` updated a `scrollY` shared value that was read
   nowhere (and `scrollEventThrottle={200}` confirmed it did nothing useful) — wasted
   work on every scroll frame. The handler now drives a floating "scroll to top"
   button that appears after the user scrolls past the fold
   (`SCROLL_TOP_THRESHOLD = 600`) and returns to the top with haptics + an SR
   announcement. Mirrors the FAB convention already used on the Questions tab
   (`right: SPACING.lg`, `zIndex: 1000`, insets-aware `bottom`). Throttle lowered to
   `16` for smooth UI-thread updates; React state only flips on visibility change
   (UI-thread latch → one `runOnJS` per change, not per frame).

2. **Pull-to-refresh now refetches the unread-notification count.**
   `onRefresh` refetched every data source *except* the notification badge, so the
   bell count went stale after a manual refresh. Added `refetchUnreadCount()` to the
   `Promise.all` and its `useCallback` deps.

3. **Hero reward shows a skeleton instead of a blank gap while loading.**
   The `hero-reward` section returned `null` when `dailyReward` was still in flight,
   so the card popped in late and shoved the whole feed downward (layout shift). It
   now renders the existing `HeroCardSkeleton` until data arrives.

4. **"For You" empty state polish.** The "Personalized earning opportunities"
   subtitle is hidden when there are zero opportunities, so the empty-state card
   stands alone instead of sitting under a now-meaningless subtitle.

### Invariants established (locked by tests)

- Home renders a hero **skeleton** (a11y label "Loading daily reward"), not the real
  card, while `useDailyReward` has no data; the card replaces it once data arrives.
- Pull-to-refresh calls the unread-notification refetch exactly once.
- The scroll-to-top FAB (a11y label "Scroll to top") is **absent** on initial render.

### Tests

- `__tests__/ui/home-redesigned.ui.test.tsx` (new) — 4 cases covering the three
  invariants above. Verified: `tsc --noEmit` clean; full suite 43 suites / 286 tests
  green; `eslint` 0 errors on changed files.

### Known finding — NOT changed here (needs a decision)

`useDailyReward` (a **read** hook, `services/hooks.ts`) calls
`api.rewards.claimDaily()`, which **POSTs** to `/api/rewards/daily` — the same
endpoint the `useClaimDailyReward` mutation uses. There is no separate GET status
route. So every Home mount/refetch POSTs to the daily-reward endpoint. Depending on
backend semantics this is either merely wasteful/semantically wrong (idempotent
status) or actively harmful (auto-claims on load). The hook's fallback comment
("Backend route not implemented yet") suggests the route may be absent, which would
also mean the daily-reward feature is currently inert. Left untouched because the
correct fix (a dedicated GET status endpoint) is a backend-contract change and
risks breaking the claim flow — flag for product/backend owner.
