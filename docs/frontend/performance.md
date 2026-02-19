# Performance Guide

Performance optimizations applied across the DelipuCash frontend, with patterns for maintaining 60fps scrolling and minimal re-renders.

## Table of Contents

- [General Patterns](#general-patterns)
- [Question Screen](#question-screen)
- [Video Screen](#video-screen)
- [Home Screen](#home-screen)
- [Ad Integration](#ad-integration)
- [State Management Performance](#state-management-performance)

## General Patterns

### React.memo for List Items

Every component rendered inside a FlatList uses `React.memo`:

```typescript
const VideoFeedItem = React.memo(function VideoFeedItem(props) {
  // Component body
}, arePropsEqual); // Optional custom comparison
```

### useMemo for Expensive Computations

```typescript
// Good: memoize derived data
const videosWithAds = useMemo(() => {
  return insertAdsIntoFeed(allVideos, videoAds);
}, [allVideos, videoAds]);

// Bad: recompute on every render
const videosWithAds = insertAdsIntoFeed(allVideos, videoAds);
```

### useCallback for Stable Handler Identity

```typescript
// Good: stable reference prevents child re-renders
const handleLike = useCallback((video) => {
  toggleLike(video.id);
}, [toggleLike]);

// Bad: new function on every render
const handleLike = (video) => toggleLike(video.id);
```

### Ref-Mirrored State

For values that change often but are read in callbacks:

```typescript
const [sessionAdCount, setSessionAdCount] = useState(0);
const sessionAdCountRef = useRef(sessionAdCount);
useEffect(() => { sessionAdCountRef.current = sessionAdCount; }, [sessionAdCount]);

// Read from ref in callbacks — no dependency, no recreation
const handleVideoEnd = useCallback(() => {
  if (sessionAdCountRef.current < MAX) { /* ... */ }
}, []); // Empty deps, always current value
```

**Why:** Without refs, `handleVideoEnd` would need `sessionAdCount` in deps, causing recreation on every ad impression, which cascades re-renders through `VerticalVideoFeed`.

## Question Screen

**File:** `app/(tabs)/questions-new.tsx`

| Optimization | Impact |
|-------------|--------|
| Server-side pagination | `useQuestionsFeed` passes `?tab=&page=&limit=` — no client-side filtering of 1000s of questions |
| `FeedHeader` as `React.memo` | Prevents header thrashing during feed scrolling |
| ID-based handlers | `onPress={(id) => ...}` instead of `onPress={() => handle(item)}` — no inline closures |
| FadeIn cap | `MAX_ANIMATED_INDEX = 8` — only first 8 items animate, rest render instantly |
| Tab persistence | `selectedTab` in Zustand — no flash on screen focus |
| `placeholderData: keepPreviousData` | No content flash when switching tabs |
| Deferred ad loading | `enabled: !isFeedLoading` — ads don't block initial feed |
| Consolidated ad hooks | `useScreenAds` replaces 3 separate hooks |

## Video Screen

**File:** `app/(tabs)/videos-new.tsx`

| Optimization | Impact |
|-------------|--------|
| FlatList tuning | `windowSize=5`, `maxToRenderPerBatch=2`, `removeClippedSubviews=true` |
| Viewability-based playback | Only visible video plays — others paused |
| `MiniPlayerWrapper` isolation | `React.memo` isolates 250ms progress re-renders |
| 4 ref-mirrored values | `videosWatchedCount`, `sessionAdCount`, `likedVideoIds`, `bookmarkedVideoIds` |
| Memoized tab icons | `useMemo` prevents AnimatedTabPill re-renders |
| Stable action selectors | Individual `useVideoFeedStore(s => s.toggleLike)` — no full-store subscription |
| Round-robin interstitial | `interstitialAdIndexRef` — ref-based, no state update |
| AppState lifecycle | Pause on background, resume on foreground |
| Data saver mode | Skip neighbor preloading when enabled |
| Session-aware ad insertion | Reads `sessionAdCountRef` in useMemo to avoid recomputation on every impression |

### FlatList Configuration

```typescript
<FlatList
  data={videos}
  windowSize={5}              // Render 5 screens worth of items
  maxToRenderPerBatch={2}     // Max 2 items per render batch
  removeClippedSubviews={true} // Unmount off-screen views
  viewabilityConfig={{
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }}
/>
```

## Home Screen

**File:** `app/(tabs)/home-redesigned.tsx`

| Optimization | Impact |
|-------------|--------|
| FlatList virtualization | Long lists use FlatList, not ScrollView |
| Skeleton loaders | Shows placeholders during data fetch |
| Memoized sub-components | PersonalizedHeader, HeroRewardCard, QuickActions |
| Reanimated animations | 60fps via native thread |
| 44x44dp touch targets | Accessibility without hit slop hacks |

## Ad Integration

### Feed Ad Insertion

```typescript
const videosWithAds = useMemo(() => {
  // Read session count from ref — doesn't trigger recomputation
  const currentAdCount = sessionAdCountRef.current;
  if (currentAdCount >= MAX) return baseVideos; // Skip insertion

  // Insert ad every N videos
  baseVideos.forEach((video, index) => {
    result.push(video);
    if ((index + 1) % interval === 0) {
      result.push(adAsVideo);
    }
  });
  return result;
}, [allVideos, videoAds]); // sessionAdCount NOT in deps
```

### Viewability Tracking

Ad viewability tracking uses refs exclusively to avoid re-renders during scroll:

```typescript
// Refs for tracking — updated every scroll frame, no re-renders
const viewabilityPercentRef = useRef(0);
const visibleStartTimeRef = useRef(0);
const hasRecordedViewableRef = useRef(false);

// Only one state update when viewability confirmed
const [isViewable, setIsViewable] = useState(false);
```

### Frequency Capping

`AdFrequencyManager` is a singleton — initialized once, no per-render instantiation:

```typescript
const manager = AdFrequencyManager.getInstance(); // Cached singleton
manager.canShowAd('interstitial'); // O(1) lookup
```

## State Management Performance

### Store Selector Granularity

```typescript
// Optimal: subscribes to one action, never re-renders
const toggleLike = useVideoFeedStore(s => s.toggleLike);

// OK for related values: useShallow batches
const { status, progress } = useVideoFeedStore(useShallow(s => ({
  status: s.activeVideo.status,
  progress: s.activeVideo.progress,
})));

// Worst: subscribes to entire store
const store = useVideoFeedStore(); // Re-renders on ANY change
```

### Zustand Persistence Optimization

Only persist what matters across sessions:

```typescript
partialize: (state) => ({
  selectedTab: state.selectedTab,       // Persist
  attemptHistory: state.attemptHistory, // Persist
  // NOT: sessionSummary, isOnline, modals, loading states
}),
```

### Animation Capping

Prevent scroll jank from too many entering animations:

```typescript
const MAX_ANIMATED_INDEX = 8;

const AnimatedItem = ({ index, children }) => {
  if (index >= MAX_ANIMATED_INDEX) return children; // No animation
  return (
    <Animated.View entering={FadeIn.delay(index * 50)}>
      {children}
    </Animated.View>
  );
};
```

## Survey Builder

**File:** `app/create-survey.tsx` + `components/survey/SurveyForm.tsx`

| Optimization | Impact |
|-------------|--------|
| SurveyBuilderStore | Central state replaces per-component useState — one source of truth |
| Undo middleware coalescing | 1000ms debounce on text input — prevents stack pollution |
| Bounded undo stack | Max 50 entries — prevents unbounded memory growth |
| DraggableQuestionList | Reanimated 2 gesture handler — animations on native thread |
| `React.memo` sub-components | UndoRedoToolbar, ConditionalLogicEditor — isolated re-renders |
| Persistence migration | v0→v1 migration adds missing fields without breaking existing drafts |
| FlatList tuning (surveys-new.tsx) | `windowSize=5`, `maxToRenderPerBatch=5`, `initialNumToRender=8` |
| Deferred ad loading | `enabled: !isFeedLoading` — ads don't block survey feed |
| WCAG touch targets | 44x44 ad dismiss button — no hit slop workarounds needed |

## Reward Question Screens

**Files:** `app/reward-question/[id].tsx`, `app/instant-reward-answer/[id].tsx`

| Optimization | Impact |
|-------------|--------|
| Memoized sub-components | `CountdownTimer`, `OptionItem`, `WinnerRow`, `TrustCard`, `WinnersSection` all `React.memo` |
| `useMemo` for derived data | options, spotsLeft, isClosed, unansweredQuestions, sessionProgress |
| `useCallback` for handlers | handleSelectOption, handleSubmit — stable references |
| `useShallow` for grouped Zustand reads | wallet, session, sessionType, sessionSummary — no full-store subscription |
| Ref-based callback stability | `activeQuestionsRef`, `openQuestionsRef` — prevent re-render cascade |
| Submit debounce guard | `submitGuardRef` — 2s ref-based guard prevents double-tap |
| Deterministic confetti | `seededRandom(index * 9301 + 49297)` — stable across re-renders |
| Wallet sync on mount | All 4 reward screens sync `user.points` → Zustand wallet on load |
| FlatList tuning (listing) | `maxToRenderPerBatch=8`, `windowSize=5`, `removeClippedSubviews`, `initialNumToRender=6` |
