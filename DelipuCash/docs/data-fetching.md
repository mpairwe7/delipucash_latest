# Data fetching architecture

How server state is fetched, cached, and mutated in this app, and the recipe for
migrating any remaining `useEffect`-based fetching. TanStack Query v5 is the
single source of truth for server state; Zustand holds client/UI state only
(auth session, theme, per-screen UI stores).

## Stack and rationale

- **TanStack Query v5** (`@tanstack/react-query`) — caching, deduplication,
  retries, background refetch, optimistic mutations, infinite pagination.
- **`@tanstack/react-query-persist-client` + AsyncStorage persister** — the
  cache survives cold starts, so every screen renders instantly from disk and
  revalidates in the background (stale-while-revalidate).
- **Expo Router** for navigation. We deliberately do *not* use route-loader
  APIs (React Router v6 loaders/actions, TanStack Router loaders): those are
  web-router features that don't exist on React Navigation. The equivalent
  pattern here is **prefetch on intent** — warm the cache before navigation
  with `queryClient.prefetchQuery`/`prefetchInfiniteQuery` (see
  `usePrefetchQuestions` in `services/questionHooks.ts`, wired up in
  `app/(tabs)/questions-new.tsx`), so the target screen mounts with data
  already cached — same UX as a loader, without fighting the router.

## Setup (already wired — don't duplicate)

`services/queryClient.ts` is the single module that owns:

- the `QueryClient` (retry with exponential backoff, `staleTime` 2 min,
  `gcTime` 24 h, `networkMode: 'offlineFirst'`);
- the AsyncStorage persister (`QUERY_PERSIST_KEY`, 24 h `maxAge`, 2 s write
  throttle);
- `onlineManager` ← `@react-native-community/netinfo`: fetches pause offline
  and **refetch on reconnect**;
- `focusManager` ← `AppState`: stale queries **refetch when the app returns
  to the foreground** (RN has no window focus — AppState is the equivalent);
- the auth-transition watcher that clears the cache (memory + persisted) on
  passive logout so one user's data never leaks to the next.

`app/_layout.tsx` consumes it via `PersistQueryClientProvider`. Screens never
create clients; tests use `test-utils/createTestQueryClient.ts`.

## The hooks pattern

Never call `fetch`/API modules from components, and never fetch in
`useEffect`. Each domain gets a `services/<domain>Hooks.ts` exposing typed
hooks; screens compose hooks and derive UI state. Reference implementations:

| Concern | Reference |
| --- | --- |
| Query key factory | `questionQueryKeys` in `services/questionHooks.ts` |
| Plain queries + per-tab loading/error | `services/supportHooks.ts` |
| Infinite pagination | `useInfiniteQuestionsFeed` (`getNextPageParam` from server `hasMore`) |
| Optimistic mutation with rollback | `useVoteQuestion` (multi-cache), `useLikeResponse`/`useDislikeResponse` (reaction toggle), `useRateFAQ` (simple counter) |
| Debounced server-backed search | `useSearchFAQs` + `hooks/useDebouncedValue.ts` |
| Prefetch (loader equivalent) | `usePrefetchQuestions`, `usePrefetchVideos` |
| Detail seeded from list caches | `findCachedVideo` + `placeholderData` in `useVideoDetails` |
| Pull-to-refresh | `useRefreshSupport` (invalidate root key, `refetchType: 'active'`) |
| Suspense variants | `useSuspenseQuestionDetail` etc. |

Conventions:

- **Key factories, not string literals.** Every key derives from the domain
  root (`['support']`, `['questions']`) so `invalidateQueries` on the root
  covers the whole domain and granular keys stay collision-free.
- **`isPending` for skeletons** — it's only true when there's no data at all,
  so persisted caches render instantly and refetches don't flash skeletons.
  Use `isFetching`/`isRefetching` for unobtrusive spinners.
- **Errors**: throw from `queryFn` (normalize `ApiResponse` → `throw new
  Error(response.error)`), render per-resource error states with a retry that
  invalidates. Don't store errors in `useState`.
- **Mutations**: `onMutate` cancel + snapshot + optimistic write, `onError`
  rollback from the snapshot, `onSettled` invalidate (skip invalidation only
  when the backend can't return the canonical state yet — documented inline in
  `useRateFAQ`).
- **Extract `.mutate`** (`const voteMutate = useVoteQuestion().mutate`) when
  used in `useCallback` deps — the mutation result object is a new reference
  every render; `.mutate` is stable.
- **Lists**: pass stable references. Fall back to a module-level `EMPTY`
  array, not a fresh `?? []`, so downstream `useMemo`s don't recompute every
  render.

## Refactor recipe: `useEffect` fetching → hooks

`app/help-support.tsx` is the worked example (migrated 2026-07). The legacy
shape and its replacement:

```tsx
// BEFORE — manual server state (6 useState slots + 2 effects)
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [faqs, setFaqs] = useState<FAQItem[]>([]);
// ... contacts, quickActions, tutorials, categories, searchResults

const loadData = useCallback(async (silent = false) => {
  if (!silent) setIsLoading(true);
  setError(null);
  try {
    const [faqData, contactData /* ... */] = await Promise.all([
      fetchFAQs(), fetchContactMethods(), /* ... */
    ]);
    setFaqs(faqData); /* ... */
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed');
  } finally {
    if (!silent) setIsLoading(false);
  }
}, []);

useEffect(() => { loadData(); }, [loadData]);

useEffect(() => {                       // debounced search
  const t = setTimeout(async () => {
    if (searchQuery.trim().length > 2) setSearchResults(await searchFAQs(searchQuery));
  }, 300);
  return () => clearTimeout(t);
}, [searchQuery]);
```

```tsx
// AFTER — server state in hooks, UI derives from queries
const faqsQuery = useFAQs();
const contactsQuery = useContactMethods();
// ... one hook per resource (they run in parallel automatically)

const debouncedSearch = useDebouncedValue(searchQuery, 300);
const searchResultsQuery = useSearchFAQs(debouncedSearch); // enabled > 2 chars, keepPreviousData

const rateFAQMutate = useRateFAQ().mutate;                 // optimistic counter
const refreshSupport = useRefreshSupport();                // pull-to-refresh / retry

const faqs = faqsQuery.data ?? EMPTY;
const isFAQLoading = faqsQuery.isPending || categoriesQuery.isPending;
const faqError = faqsQuery.error ?? categoriesQuery.error;
```

What the migration buys, for free: request deduplication, cache persistence
(instant cold-start render), refetch on foreground + reconnect, retry with
backoff, per-resource error isolation (one failing endpoint no longer blanks
every tab), and optimistic UI with rollback.

Steps for the next legacy screen you touch:

1. Create/extend `services/<domain>Hooks.ts`: key factory + one hook per
   resource + mutations (follow `supportHooks.ts`).
2. Delete the `useState` server-data slots, the `loadData` callback, and the
   fetch `useEffect`s; call the hooks.
3. Derive `isLoading`/`error` per resource from the queries; wire retry and
   pull-to-refresh to invalidation, not to a bespoke reload function.
4. Replace hand-rolled debounce effects with `useDebouncedValue` feeding an
   `enabled`-gated query.
5. Add tests for new cache logic (see
   `__tests__/supportHooks.optimistic.test.tsx`,
   `__tests__/videoHooks.optimistic.test.ts`).

## Uploads

File transfers go through `services/r2UploadService.ts` (presign → direct R2
PUT → finalize). Resilience conventions, locked in by
`__tests__/r2Upload.retry.test.ts` / `r2Upload.abort.test.ts`:

- **Retries live in the service, at step granularity** — a failed transfer
  retries with a *fresh* presigned URL (expired links recover); a failed
  finalize retries the small JSON POST with a 30 s timeout *without*
  re-transferring the file. Upload mutations therefore set `retry: 0`: the
  global `retry: 2` would re-run the whole `mutationFn` and re-upload the file.
- **Cancellation is never retried** — every step checks the caller's
  `AbortSignal`.
- **Offline queue** (`hooks/useUploadQueueProcessor.ts`): pending uploads
  persist in `VideoStore`, retry on reconnect (max 3 attempts, with a
  "Retrying N queued uploads…" toast), and verify the local file still exists
  before attempting — a purged cache file is dropped with a specific message
  instead of burning retries.
- **Finalize-only recovery**: if the transfer succeeded but finalize
  ultimately failed, the thrown error carries `finalizePayload`; the modal
  queues it and the processor re-sends **only** the finalize call via
  `finalizeVideoUploadOnly`. The server endpoint is idempotent on
  `r2VideoKey` (replays return the existing record), so this can never
  duplicate a video or re-upload bytes.
- **Double-submission**: upload buttons guard with a synchronous ref
  (`uploadInFlightRef` in `UploadModal.tsx`), not just async `useState`.

## React Native specifics

- **Background/foreground**: handled globally (focusManager ← AppState). Do
  not add per-screen AppState listeners to refetch — mark data stale via
  `staleTime` and let the global wiring refetch on resume. Token freshness on
  resume is also handled globally in `app/_layout.tsx` (proactive
  `silentRefresh`).
- **Connectivity**: `networkMode: 'offlineFirst'` + onlineManager means
  queries serve cache offline and refetch on reconnect; mutations fired
  offline pause rather than fail. UI that must react to connectivity reads
  NetInfo directly (e.g. offline banners), not query state.
- **Lists**: prefer `useInfiniteQuery` + `FlatList`/`onEndReached`
  (`hasNextPage && !isFetchingNextPage` guard) over page-number state.
- **Screen focus refetch**: navigation focus is not AppState focus. If a
  screen must be fresh on every navigation focus, keep `staleTime` low for
  that query; reserve `useFocusEffect` + `refetch` for genuinely event-driven
  cases.
