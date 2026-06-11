# Changelog

Dated audit trail of substantive change sets: what changed, why, the invariants it
establishes, and the tests that lock it in.

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
