# Services Layer

## Table of Contents

- [API Client](#api-client)
- [Feature API Modules](#feature-api-modules)
- [TanStack Query Hooks](#tanstack-query-hooks)
- [R2 Upload Service](#r2-upload-service)
- [SSE Manager](#sse-manager)
- [Ad Frequency Manager](#ad-frequency-manager)
- [Smart Ad Placement](#smart-ad-placement)

## API Client

**File:** `services/api.ts`

Central REST API client with automatic token refresh.

### Configuration

```typescript
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
```

### `fetchJson(url, options)`

All API calls go through this function:

1. Adds auth headers (`Authorization: Bearer <token>`)
2. Adds client metadata headers (`X-API-Version`, `X-Client-Platform`, `X-Request-ID`)
3. Parses JSON response
4. On 401 (expired token) → calls `silentRefresh()` → retries request
5. Returns `{ data, error }` wrapper

### Token Refresh

**File:** `services/tokenRefresh.ts`

```typescript
// Checks if response indicates expired token
isTokenExpiredResponse(status: number): boolean

// Refreshes token and retries the original request
silentRefresh(): Promise<void>
```

## Feature API Modules

Each feature domain has a dedicated API module:

| Module | File | Key Functions |
|--------|------|--------------|
| Auth | `api.ts` (authApi) | login, signup, refreshToken, forgotPassword |
| Videos | `api.ts` (videoApi) | getAll, create, like, unlike, bookmark, comment |
| Questions | `api.ts` (questionApi) | getAll, create, vote, respond |
| Surveys | `surveyApi.ts` | getAll, getById, submit, getResponses |
| Ads | `api.ts` (adsApi) | getByPlacement, recordImpression, recordClick |
| Rewards | `api.ts` (rewardsApi) | getByUser, redeem |
| Notifications | `notificationApi.ts` | getAll, markRead, getUnreadCount |
| R2 Upload | `r2UploadService.ts` | uploadVideo, uploadThumbnail, getSignedUrl |
| Support | `supportApi.ts` | getTickets, createTicket |

## TanStack Query Hooks

### Video Hooks (Preferred)

**File:** `services/videoHooks.ts`

| Hook | Type | Query Key | Purpose |
|------|------|-----------|---------|
| `useInfiniteVideos` | Infinite Query | `['videos', 'infinite']` | Paginated video feed |
| `useTrendingVideos` | Query | `['videos', 'trending']` | Trending videos |
| `useVideoCommentsQuery` | Query | `['videos', id, 'comments']` | Video comments |
| `useLikeVideo` | Mutation | | Like/unlike with optimistic update |
| `useBookmarkVideo` | Mutation | | Bookmark/unbookmark |
| `useShareVideo` | Mutation | | Track share |
| `useAddVideoComment` | Mutation | | Add comment |
| `useUnreadCount` | Query | `['notifications', 'unread']` | Notification badge count |

### Question Hooks

**File:** `services/questionHooks.ts`

| Hook | Type | Purpose |
|------|------|---------|
| `useQuestionsFeed` | Infinite Query | Paginated question feed by tab |
| `useQuestionDetail` | Query | Single question with responses |
| `useSubmitQuestionResponse` | Mutation | Submit answer with optimistic update |
| `useVoteQuestion` | Mutation | Upvote/downvote |

### Ad Hooks (Consolidated)

**File:** `services/adHooksRefactored.ts`

| Hook | Type | Purpose |
|------|------|---------|
| `useAdsForPlacement` | Query | Fetch ads for specific placement |
| `useScreenAds` | Query | Single hook replacing 3 separate ad queries |
| `useRecordAdClick` | Mutation | Record click (local + server) |
| `useRecordAdImpression` | Mutation | Record impression with viewability data |
| `useAdImpressionTracker` | Hook | Auto-record on visibility change |
| `useAdRefreshOnFocus` | Hook | Invalidate ad queries on foreground |
| `useAdFrequency` | Hook | AdFrequencyManager wrapper |

### Legacy Hooks

**File:** `services/hooks.ts`

Older hooks still in use but being migrated:

| Hook | Status | Replacement |
|------|--------|-------------|
| `useSurveys` | Active | (no replacement yet) |
| `useRunningSurveys` | Active | (no replacement yet) |
| `useQuestion` | Deprecated | `useQuestionDetail` from questionHooks.ts |
| `useSubmitResponse` | Deprecated | `useSubmitQuestionResponse` from questionHooks.ts |

## R2 Upload Service

**File:** `services/r2UploadService.ts`

| Function | Purpose |
|----------|---------|
| `validateUpload(file)` | Check MIME type and size limits |
| `uploadVideoToR2(file, userId)` | Upload video file |
| `uploadThumbnailToR2(file, userId)` | Upload thumbnail image |
| `uploadAdMediaToR2(file, userId)` | Upload ad assets |
| `getPresignedUploadUrl(key, contentType)` | Get direct-to-R2 upload URL |
| `getSignedPlaybackUrl(key)` | Get time-limited download URL |

### R2 Upload Hooks

**File:** `services/r2UploadHooks.ts`

TanStack Query mutations wrapping the upload service with progress tracking.

## SSE Manager

**Directory:** `services/sse/`

| File | Purpose |
|------|---------|
| `SSEManager.ts` | Connection lifecycle, reconnection, event dispatch |
| `useSSE.ts` | React hook for SSE subscriptions |
| `types.ts` | SSE event type definitions |

### Usage

```typescript
const { isConnected } = useSSE();

// Events are dispatched to the SSEStore and trigger
// TanStack Query invalidations for real-time updates
```

## Ad Frequency Manager

**File:** `services/adFrequencyManager.ts`

Singleton that enforces multi-level frequency caps:

| Level | Limits |
|-------|--------|
| Global session | 20 ads / 30-minute session |
| Hourly | 12 ads / hour |
| Feed placement | 10 / hour, 30s cooldown |
| Interstitial | 3 / hour, 5min cooldown |
| Video | 5 / hour, 2min cooldown |
| User fatigue | 3 dismissals → 50% reduction for 15 min |

### Key Methods

```typescript
canShowAd(placement, adId): boolean    // 7-step eligibility check
recordImpression(adId, placement): void
recordClick(adId): void
recordDismissal(adId): void
checkUserFatigue(): number             // 0-1 fatigue score
getStats(): AdStats                    // Session analytics
```

## Smart Ad Placement

**File:** `services/useSmartAdPlacement.ts`

Context-aware hook that determines if/when to show ads:

| Context | Max Ads | Min Interval |
|---------|---------|-------------|
| questions | 3 | 30s |
| videos | 2 | 60s |
| surveys | 1 | 120s |
| rewards | 2 | 45s |
| home | 4 | 20s |
| checkout | 0 | N/A |

Returns: `shouldShowAd`, `trackImpression`, `trackClick`, `isViewable`, `userFatigue`, `recommendedDelay`
