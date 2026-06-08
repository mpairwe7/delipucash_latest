/**
 * UI-consistency + a11y smoke test for app/(tabs)/videos-new.tsx (VideosScreen — the
 * TikTok-style vertical video feed).
 *
 * The feed itself is a full-screen gesture/expo-video pager (`VerticalVideoFeed`) plus ~15 data
 * hooks; its playback/scroll/gesture behaviour can't run in jsdom. So this is a deliberate SMOKE
 * test: the heavy children + all data hooks are stubbed, and we assert the header chrome renders —
 * the three feed tabs and that switching a tab updates the feed store. (Per-item interactions live
 * in component-level tests / Maestro, not here.)
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import {
  usePersonalizedFeed,
  useInfiniteFollowingVideos,
  useInfiniteTrendingVideos,
} from '@/services/videoHooks';
import { useVideoFeedStore } from '@/store/VideoFeedStore';
import { makeInfiniteVideoResult, makeVideoQuery, makeVideos } from '@/__tests__/fixtures/video.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

// GestureHandlerRootView → passthrough (no native gesture system in jsdom).
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
  };
});
jest.mock('@/services/notificationHooks', () => ({
  __esModule: true,
  useUnreadNotificationCount: () => ({ data: 0 }),
}));
jest.mock('@/services/adHooksRefactored', () => ({
  __esModule: true,
  useAdsForPlacement: () => ({ data: [], refetch: jest.fn() }),
  useRecordAdClick: () => ({ mutate: jest.fn() }),
  useRecordAdImpression: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/services/adFrequencyManager', () => ({
  __esModule: true,
  useAdFrequency: () => ({ canShowAd: () => false, recordImpression: jest.fn() }),
}));
jest.mock('@/services/useShouldShowAds', () => ({
  __esModule: true,
  useShouldShowAds: () => ({ shouldShowAds: false }),
}));
jest.mock('@/services/purchasesHooks', () => ({
  __esModule: true,
  useVideoPremium: () => ({ isPremium: false, isLoading: false }),
}));
jest.mock('@/hooks/useSearch', () => ({
  __esModule: true,
  useSearch: () => ({
    query: '', setQuery: jest.fn(), filteredResults: [], isSearching: false,
    recentSearches: [], removeFromHistory: jest.fn(), clearHistory: jest.fn(),
    submitSearch: jest.fn(), hasNoResults: false,
  }),
}));
jest.mock('@/utils/auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => ({ isReady: true, isAuthenticated: true, auth: { user: { id: 'u-1' } } }),
}));
jest.mock('@/utils/accessibility', () => ({
  ...jest.requireActual('@/utils/accessibility'),
  useReducedMotion: () => false,
}));
// Heavy children: full-screen pager / players / modals are stubbed; the error boundary passes
// children through. The header + inline tab pills (defined in the screen) render for real.
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

const mockForYou = usePersonalizedFeed as jest.Mock;
const mockFollowing = useInfiniteFollowingVideos as jest.Mock;
const mockTrending = useInfiniteTrendingVideos as jest.Mock;

beforeEach(() => {
  useVideoFeedStore.getState().reset();
  mockForYou.mockReturnValue(makeInfiniteVideoResult(makeVideos(3)));
  mockFollowing.mockReturnValue(makeInfiniteVideoResult([]));
  mockTrending.mockReturnValue(makeInfiniteVideoResult([]));
});

describe('VideosScreen — header & tabs', () => {
  it('renders the three feed tabs', () => {
    renderWithProviders(<VideosScreen />);
    for (const label of ['For You', 'Following', 'Trending']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('defaults to the For You tab', () => {
    renderWithProviders(<VideosScreen />);
    expect(useVideoFeedStore.getState().activeTab).toBe('for-you');
  });
});

describe('VideosScreen — tab switching', () => {
  it('switches the active feed tab on press', () => {
    renderWithProviders(<VideosScreen />);

    fireEvent.press(screen.getByText('Following'));
    expect(useVideoFeedStore.getState().activeTab).toBe('following');

    fireEvent.press(screen.getByText('Trending'));
    expect(useVideoFeedStore.getState().activeTab).toBe('trending');
  });
});
