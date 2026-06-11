/**
 * UI + a11y regression tests for app/(tabs)/home-redesigned.tsx (HomePage dashboard).
 *
 * Guards the home-screen gap fixes:
 *  1. Hero reward renders a SKELETON (not a blank gap) while the reward query is in
 *     flight — prevents the card popping in late and shoving the feed downward.
 *  2. Pull-to-refresh also refetches the unread-notification count (badge was stale).
 *  3. The scroll-to-top FAB is hidden until the user scrolls past the fold.
 *
 * The hook surface is mocked to benign defaults; HeroRewardCard is stubbed so the
 * skeleton ↔ card switch can be asserted without depending on its internals. The
 * skeleton, header, quick actions and the rest of @/components/home stay real.
 */
import React from 'react';
import { router } from 'expo-router';
import { renderWithProviders, screen, act } from '@/test-utils';
import { useDailyReward } from '@/services/hooks';
import { useUnreadNotificationCount } from '@/services/notificationHooks';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

// Data hooks driven/neutralised; queryKeys + the rest stay real (the screen's
// prefetch effect reads queryKeys.*).
jest.mock('@/services/hooks', () => ({
  ...jest.requireActual('@/services/hooks'),
  useTrendingVideos: jest.fn(() => ({ data: [], refetch: jest.fn(), isError: false })),
  useRecentQuestions: jest.fn(() => ({ data: [], refetch: jest.fn(), isError: false })),
  useRunningSurveys: jest.fn(() => ({ data: [], refetch: jest.fn() })),
  useUpcomingSurveys: jest.fn(() => ({ data: [], refetch: jest.fn(), isLoading: false })),
  useDailyReward: jest.fn(() => ({ data: undefined, refetch: jest.fn() })),
  useDashboardStats: jest.fn(() => ({ data: undefined, refetch: jest.fn() })),
  useClaimDailyReward: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));
jest.mock('@/services/notificationHooks', () => ({
  __esModule: true,
  useUnreadNotificationCount: jest.fn(),
}));
jest.mock('@/services/useShouldShowAds', () => ({
  __esModule: true,
  useShouldShowAds: () => ({ shouldShowAds: false }),
}));
jest.mock('@/services/adHooksRefactored', () => ({
  __esModule: true,
  useScreenAds: () => ({ data: undefined, refetch: jest.fn() }),
  useRecordAdClick: () => ({ mutate: jest.fn() }),
  useRecordAdImpression: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/services/questionHooks', () => ({
  __esModule: true,
  useQuestionsLeaderboard: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/hooks/useSearch', () => ({
  __esModule: true,
  useSearch: () => ({
    query: '',
    setQuery: jest.fn(),
    recentSearches: [],
    removeFromHistory: jest.fn(),
    clearHistory: jest.fn(),
    submitSearch: jest.fn(),
  }),
}));
jest.mock('@/utils/useUser', () => ({
  __esModule: true,
  default: () => ({
    data: { id: 'u-1', firstName: 'Test', walletBalance: 1500 },
    loading: false,
    refetch: jest.fn(),
  }),
}));

// HeroRewardCard stubbed so the skeleton ↔ card switch is observable; everything
// else exported from @/components/home (incl. HeroCardSkeleton) stays real.
jest.mock('@/components/home', () => {
  const actual = jest.requireActual('@/components/home');
  const React = require('react');
  const { View } = require('react-native');
  return {
    ...actual,
    HeroRewardCard: () => React.createElement(View, { testID: 'hero-reward-card' }),
  };
});
// Ad components are out of scope (ads are gated off via useShouldShowAds anyway).
jest.mock('@/components/ads', () => ({
  __esModule: true,
  BannerAd: () => null,
  NativeAd: () => null,
  InFeedAd: () => null,
  BetweenContentAd: () => null,
  AdPlacementWrapper: () => null,
}));

import HomePage from '@/app/(tabs)/home-redesigned';

const mockDailyReward = useDailyReward as jest.Mock;
const mockUnread = useUnreadNotificationCount as jest.Mock;
const refetchUnreadCount = jest.fn();

beforeEach(() => {
  (router.push as jest.Mock).mockClear();
  refetchUnreadCount.mockClear();
  mockDailyReward.mockReturnValue({ data: undefined, refetch: jest.fn() });
  mockUnread.mockReturnValue({ data: 3, refetch: refetchUnreadCount });
});

describe('HomePage — hero reward loading state', () => {
  it('renders the hero skeleton (not a blank gap) while the reward query is in flight', () => {
    mockDailyReward.mockReturnValue({ data: undefined, refetch: jest.fn() });
    renderWithProviders(<HomePage />);

    // Header still renders (user name from useUser).
    expect(screen.getByText('Test')).toBeOnTheScreen();
    // Skeleton placeholder is shown; the real card is NOT yet mounted.
    expect(screen.getByLabelText('Loading daily reward')).toBeOnTheScreen();
    expect(screen.queryByTestId('hero-reward-card')).toBeNull();
  });

  it('swaps the skeleton for the hero card once reward data arrives', () => {
    mockDailyReward.mockReturnValue({
      data: {
        isAvailable: true,
        nextRewardIn: 0,
        currentStreak: 3,
        todayReward: 50,
        streakBonus: 5,
      },
      refetch: jest.fn(),
    });
    renderWithProviders(<HomePage />);

    expect(screen.getByTestId('hero-reward-card')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Loading daily reward')).toBeNull();
  });
});

describe('HomePage — scroll-to-top FAB', () => {
  it('is hidden on initial render (only appears after scrolling past the fold)', () => {
    renderWithProviders(<HomePage />);
    expect(screen.queryByLabelText('Scroll to top')).toBeNull();
  });
});

describe('HomePage — pull to refresh', () => {
  it('also refetches the unread-notification count', async () => {
    renderWithProviders(<HomePage />);

    const list = screen.getByLabelText('Dashboard');
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });

    expect(refetchUnreadCount).toHaveBeenCalledTimes(1);
  });
});
