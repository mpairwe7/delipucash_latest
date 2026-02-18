# State Management

## Architecture

DelipuCash separates state into three layers:

```text
┌──────────────────────────────────────────────────────────┐
│                    State Architecture                     │
├──────────────┬──────────────────┬────────────────────────┤
│   Zustand    │  TanStack Query  │  SecureStore /         │
│ (UI State)   │  (Server State)  │  AsyncStorage          │
├──────────────┼──────────────────┼────────────────────────┤
│ Tab selection │ API responses    │ JWT tokens (encrypted) │
│ Form drafts  │ Cache management │ App preferences        │
│ Modal state  │ Background sync  │ Search history         │
│ View modes   │ Optimistic       │ Zustand persistence    │
│ Local metrics│   updates        │                        │
│ Offline queue│ Pagination       │                        │
└──────────────┴──────────────────┴────────────────────────┘
```

### Why Two State Systems?

| Concern | Zustand | TanStack Query |
|---------|---------|---------------|
| Source of truth | Client-only (UI preferences) | Server (canonical data) |
| Persistence | AsyncStorage (selective) | In-memory cache + optional persist |
| Invalidation | Manual (rare) | Automatic (stale time, refetch on focus) |
| Optimistic updates | Immediate store mutation | Mutation + rollback |
| Offline | Queue pending actions | Retry failed requests |

## Zustand Stores (15 Total)

### QuestionUIStore

**File:** `store/QuestionUIStore.ts`

| State | Type | Persisted | Purpose |
|-------|------|-----------|---------|
| `selectedTab` | FeedTabId | Yes | Remember last active question tab |

### QuestionAnswerStore

**File:** `store/QuestionAnswerStore.ts`

| State | Type | Purpose |
|-------|------|---------|
| `activeQuestionId` | string | Currently answering question |
| `draftText` | string | Draft answer text |
| `submitted` | boolean | Was answer submitted? |

Selectors: `selectRemainingChars`, `selectIsValidLength`, `selectWasSubmitted`

### VideoFeedStore

**File:** `store/VideoFeedStore.ts`

The most complex store — orchestrates TikTok/Reels-style video playback.

| State Group | Fields | Purpose |
|-------------|--------|---------|
| `activeVideo` | status, progress, id | Currently playing video |
| `feedMode` | 'vertical' \| 'grid' | Feed display mode |
| `ui` | commentsVideoId, fullPlayerVideoId, miniPlayerVideoId, refreshing, loadingMore | UI overlay state |
| `likedVideoIds` | Set | Optimistic like tracking |
| `bookmarkedVideoIds` | Set | Optimistic bookmark tracking |

23 selectors + convenience hooks: `useActiveVideo()`, `useFeedUI()`, `useFeedGesture()`

### VideoStore

**File:** `store/VideoStore.ts`

| State Group | Fields | Purpose |
|-------------|--------|---------|
| Premium | isPremium, limits | Upload/recording limits |
| Upload | progress, status, error | Upload progress tracking |
| Recording | isRecording, duration | Camera recording state |
| Livestream | sessionId, viewerCount, status | Live stream state |
| Player | isPlaying, currentTime, duration | Video player state |

25+ selectors, convenience hooks: `useVideoPremiumStatus()`, `useVideoPlayer()`

### InstantRewardStore

**File:** `store/InstantRewardStore.ts`

| State Group | Fields | Purpose |
|-------------|--------|---------|
| Session | questionsAnswered, correctAnswers, totalEarned, currentStreak, maxStreak, bonusPoints, totalTimeSpentMs | Live quiz session tracking |
| Wallet | walletBalance | Earned rewards |
| Redemption | status, provider, amount | Payout state |
| Offline | pendingSubmissions, isOnline | Queue for offline answers |
| History | attemptHistory | Which questions user attempted |

Key selectors: `selectCanRedeem`, `selectSessionAccuracy`, `selectStreakInfo`

### QuizStore

**File:** `store/QuizStore.ts`

| State Group | Fields | Purpose |
|-------------|--------|---------|
| Session | state (IDLE/ANSWERING/COMPLETED), progress | Quiz lifecycle |
| Timer | timeRemaining, isRunning | Countdown |
| Score | correct, incorrect, streak, points | Scoring |
| Redemption | status, provider | Payout state |

20+ selectors, convenience hooks: `useQuizProgress()`, `useQuizScore()`, `useQuizTimer()`

### AdUIStore

**File:** `store/AdUIStore.ts`

| State Group | Fields | Purpose |
|-------------|--------|---------|
| Preferences | personalizedAds, adFrequency, blockedCategories | User ad preferences |
| Metrics | localImpressions, localMetrics | Client-side analytics |
| Queue | adQueue, currentQueueIndex | Ad display queue |
| Modal | isAdModalVisible, currentModalAd | Feedback modal |

Persisted: `preferences` + `localMetrics` only (not session state)

### SurveyAttemptStore

**File:** `store/SurveyAttemptStore.ts`

| State | Purpose |
|-------|---------|
| activeSurvey | Currently active survey |
| answers | Draft answers (auto-saved) |
| currentIndex | Current question index |
| submissionStatus | Submission progress |

### SurveyUIStore

**File:** `store/SurveyUIStore.ts`

| State | Purpose |
|-------|---------|
| activeTab | Survey list tab |
| filters | Active filters |
| creationMode | Builder view mode |
| drafts | Saved survey drafts |
| accessibilityPrefs | High contrast, reduced motion, larger text |

### SurveyResponseUIStore

**File:** `store/SurveyResponseUIStore.ts`

| State | Purpose |
|-------|---------|
| viewMode | Response view (list/chart) |
| filters | Response filters |
| searchQuery | Search within responses |

Helper functions: `parseResponseData`, `computeAnalytics`, `exportToCSV`, `exportToJSON`

### SSEStore

**File:** `store/SSEStore.ts`

| State | Purpose |
|-------|---------|
| status | Connection status |
| enabled | Is SSE enabled? |

### HomeUIStore

Home screen UI preferences and state.

## TanStack Query Patterns

### Query Configuration

```typescript
// Standard query with caching
const { data, isLoading } = useQuery({
  queryKey: ['videos', 'all'],
  queryFn: () => videoApi.getAll(),
  staleTime: 5 * 60 * 1000,    // 5 minutes
  gcTime: 30 * 60 * 1000,       // 30 minutes garbage collection
});

// Infinite scroll
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['videos', 'infinite'],
  queryFn: ({ pageParam = 1 }) => videoApi.getAll({ page: pageParam, limit: 15 }),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});
```

### Optimistic Updates

```typescript
const likeMutation = useMutation({
  mutationFn: (videoId) => videoApi.like(videoId),
  onMutate: async (videoId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['videos'] });
    // Snapshot previous value
    const previous = queryClient.getQueryData(['videos']);
    // Optimistically update
    queryClient.setQueryData(['videos'], (old) => /* updated */);
    return { previous };
  },
  onError: (err, videoId, context) => {
    // Rollback on error
    queryClient.setQueryData(['videos'], context.previous);
  },
});
```

### Query Invalidation

```typescript
// After mutation, invalidate related queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['videos'] });
  queryClient.invalidateQueries({ queryKey: ['user', 'stats'] });
}
```

## Key Patterns

### Individual Selectors

```typescript
// Good — subscribes only to setFeedMode changes
const setFeedMode = useVideoFeedStore(s => s.setFeedMode);

// Bad — subscribes to ALL store changes
const { setFeedMode, toggleLike, ... } = useVideoFeedStore();
```

### useShallow for Grouped Reads

```typescript
// When you need multiple values, use useShallow to batch
const { commentsVideoId, fullPlayerVideoId } = useVideoFeedStore(
  useShallow(s => ({
    commentsVideoId: s.ui.commentsVideoId,
    fullPlayerVideoId: s.ui.fullPlayerVideoId,
  }))
);
```

### Ref-Mirrored State

For values that change frequently but are read in callbacks:

```typescript
const [count, setCount] = useState(0);
const countRef = useRef(count);
useEffect(() => { countRef.current = count; }, [count]);

// Handler reads ref — stable identity, always current value
const handleEvent = useCallback(() => {
  console.log(countRef.current); // Always latest
}, []); // Empty deps — never recreated
```

### Persistence Config

```typescript
const useStore = create(
  persist(
    (set, get) => ({ ... }),
    {
      name: '@store_key',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist what matters across sessions
        selectedTab: state.selectedTab,
        // DON'T persist: session state, loading flags, modals
      }),
    }
  )
);
```
