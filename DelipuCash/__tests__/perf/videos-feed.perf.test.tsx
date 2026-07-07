/**
 * Performance regression guard — VideosScreen feed (videos-new.tsx).
 * Commit-count baselines for initial render and a tab switch. Same heavy-child + hook stubs as
 * the smoke test (the feed can't run its real pager in jsdom). Mirrors surveys-feed.perf.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProfiler } from '@/test-utils';
import { usePersonalizedFeed, useInfiniteFollowingVideos, useInfiniteTrendingVideos } from '@/services/videoHooks';
import { useVideoFeedStore } from '@/store/VideoFeedStore';
import { makeInfiniteVideoResult, makeVideos } from '@/__tests__/fixtures/video.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-gesture-handler', () => ({
  __esModule: true,
  GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('@/services/videoHooks', () => {
  const infinite = () => ({
    data: { pages: [{ videos: [], nextPage: null }], pageParams: [1] },
    isLoading: false, isFetching: false, isFetchingNextPage: false, hasNextPage: false,
    fetchNextPage: jest.fn(), refetch: jest.fn(), isError: false, error: null,
  });
  return {
    __esModule: true,
    useInfiniteVideos: jest.fn(infinite),
    useTrendingVideos: jest.fn(infinite),
    usePersonalizedFeed: jest.fn(infinite),
    useInfiniteTrendingVideos: jest.fn(infinite),
    useInfiniteFollowingVideos: jest.fn(infinite),
    useVideoSearchInfinite: jest.fn(infinite),
    useExploreVideos: jest.fn(() => ({ data: [] })),
    useLikeVideo: jest.fn(() => ({ mutate: jest.fn() })),
    useBookmarkVideo: jest.fn(() => ({ mutate: jest.fn() })),
    useShareVideo: jest.fn(() => ({ mutate: jest.fn() })),
    useAddVideoComment: jest.fn(() => ({ mutateAsync: jest.fn() })),
    useVideoCommentsQuery: jest.fn(() => ({ data: undefined, isLoading: false, refetch: jest.fn(), isRefetching: false })),
    useVideoFeedback: jest.fn(() => ({ mutate: jest.fn() })),
    useRecordVideoCompletion: jest.fn(() => ({ mutate: jest.fn() })),
    useBlockUser: jest.fn(() => ({ mutate: jest.fn() })),
    usePrefetchVideos: jest.fn(() => jest.fn()),
    FOLLOWING_FEED_PAGE_LIMIT: 15,
    TRENDING_FEED_PAGE_LIMIT: 20,
  };
});
jest.mock('@/services/notificationHooks', () => ({ __esModule: true, useUnreadNotificationCount: () => ({ data: 0 }) }));
jest.mock('@/services/adHooksRefactored', () => ({
  __esModule: true,
  useAdsForPlacement: () => ({ data: [], refetch: jest.fn() }),
  useRecordAdClick: () => ({ mutate: jest.fn() }),
  useRecordAdImpression: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/services/adFrequencyManager', () => ({ __esModule: true, useAdFrequency: () => ({ canShowAd: () => false, recordImpression: jest.fn() }) }));
jest.mock('@/services/useShouldShowAds', () => ({ __esModule: true, useShouldShowAds: () => ({ shouldShowAds: false }) }));
jest.mock('@/services/purchasesHooks', () => ({ __esModule: true, useVideoPremium: () => ({ isPremium: false, isLoading: false }) }));
jest.mock('@/hooks/useSearch', () => ({
  __esModule: true,
  useSearch: () => ({
    query: '', setQuery: jest.fn(), filteredResults: [], isSearching: false,
    recentSearches: [], removeFromHistory: jest.fn(), clearHistory: jest.fn(), submitSearch: jest.fn(), hasNoResults: false,
  }),
}));
jest.mock('@/utils/auth/useAuth', () => ({ __esModule: true, useAuth: () => ({ isReady: true, isAuthenticated: true, auth: { user: { id: 'u-1' } } }) }));
jest.mock('@/utils/accessibility', () => ({ ...jest.requireActual('@/utils/accessibility'), useReducedMotion: () => false }));
jest.mock('@/components/video', () => ({
  __esModule: true,
  VerticalVideoFeed: () => null,
  VideoPlayer: () => null,
  EnhancedMiniPlayer: () => null,
  VideoCommentsSheet: () => null,
  VideoOptionsSheet: () => null,
  UploadModal: () => null,
  CollapsibleSearchBar: () => null,
  VideoErrorBoundary: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock('@/components/livestream', () => ({ __esModule: true, LiveStreamScreen: () => null }));
jest.mock('@/components/ads', () => ({ __esModule: true, InterstitialAd: () => null, AdFeedbackModal: () => null }));
jest.mock('@/components/cards', () => ({ __esModule: true, SearchOverlay: () => null }));

import VideosScreen from '@/app/(tabs)/videos-new';

beforeEach(() => {
  useVideoFeedStore.getState().reset();
  (usePersonalizedFeed as jest.Mock).mockReturnValue(makeInfiniteVideoResult(makeVideos(3)));
  (useInfiniteFollowingVideos as jest.Mock).mockReturnValue(makeInfiniteVideoResult([]));
  (useInfiniteTrendingVideos as jest.Mock).mockReturnValue(makeInfiniteVideoResult([]));
});

// Measured baselines (+1 margin). Update intentionally if the feed's render model changes.
// Measured (heavy children stubbed): initial = 1 commit; tab switch = 1.
const MAX_INITIAL_COMMITS = 2;
const MAX_COMMITS_PER_TAB_SWITCH = 2;

test('initial videos feed render commit count stays within baseline', () => {
  const { profiler } = renderWithProfiler(<VideosScreen />);
  expect(profiler.commits).toBeLessThanOrEqual(MAX_INITIAL_COMMITS);
  expect(profiler.commits).toBeGreaterThan(0);
});

test('switching a feed tab stays within the commit baseline', () => {
  const { profiler, getByText } = renderWithProfiler(<VideosScreen />);
  const before = profiler.commits;
  fireEvent.press(getByText('Trending'));
  expect(profiler.commits - before).toBeLessThanOrEqual(MAX_COMMITS_PER_TAB_SWITCH);
});
