/**
 * Performance regression guard — QuestionsScreen feed (questions-new.tsx).
 *
 * Commit-count baselines for initial feed render and a tab switch. Same mock surface as the
 * UI test (gamification/ads stubbed; FeedTabs + QuestionFeedItem real). Thresholds are
 * measured baselines + margin; an added render pass or a tab-switch render storm fails here.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProfiler } from '@/test-utils';
import { useInfiniteQuestionsFeed } from '@/services/questionHooks';
import { useQuestionUIStore } from '@/store';
import { makeInfiniteFeedResult } from '@/__tests__/fixtures/question.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/questionHooks', () => ({
  ...jest.requireActual('@/services/questionHooks'),
  useInfiniteQuestionsFeed: jest.fn(),
  useUserQuestionsStats: jest.fn(() => ({ data: undefined, isLoading: false, refetch: jest.fn() })),
  useQuestionsLeaderboard: jest.fn(() => ({ data: undefined })),
  usePrefetchQuestions: jest.fn(() => jest.fn()),
  useVoteQuestion: jest.fn(() => ({ mutate: jest.fn() })),
  useCreateQuestion: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));
jest.mock('@/services/notificationHooks', () => ({
  __esModule: true,
  useUnreadNotificationCount: () => ({ data: 0 }),
}));
jest.mock('@/services/configHooks', () => ({
  __esModule: true,
  useRewardConfig: () => ({ data: undefined }),
}));
jest.mock('@/services/useShouldShowAds', () => ({
  __esModule: true,
  useShouldShowAds: () => ({ shouldShowAds: false }),
}));
jest.mock('@/services/adHooksRefactored', () => ({
  __esModule: true,
  useScreenAds: () => ({ data: undefined }),
  useRecordAdClick: () => ({ mutate: jest.fn() }),
  useRecordAdImpression: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/hooks/useSearch', () => ({
  __esModule: true,
  useSearch: () => ({
    query: '',
    setQuery: jest.fn(),
    filteredResults: [],
    isSearching: false,
    recentSearches: [],
    removeFromHistory: jest.fn(),
    clearHistory: jest.fn(),
    submitSearch: jest.fn(),
    hasNoResults: false,
  }),
}));
jest.mock('@/utils/useUser', () => ({
  __esModule: true,
  default: () => ({ data: { id: 'u-1', firstName: 'Test' }, loading: false }),
}));
jest.mock('@/utils/auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => ({ isReady: true, isAuthenticated: true }),
}));
jest.mock('@/components/feed', () => ({
  ...jest.requireActual('@/components/feed'),
  DailyProgress: () => null,
  LeaderboardSnippet: () => null,
  RewardProgress: () => null,
  AnswerEarnCTA: () => null,
  InstantRewardCTA: () => null,
  AskCommunityCTA: () => null,
}));
jest.mock('@/components/ads', () => ({
  __esModule: true,
  InFeedAd: () => null,
  BetweenContentAd: () => null,
  AdPlacementWrapper: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import QuestionsScreen from '@/app/(tabs)/questions-new';

beforeEach(() => {
  (useInfiniteQuestionsFeed as jest.Mock).mockReturnValue(makeInfiniteFeedResult());
  useQuestionUIStore.setState({ selectedTab: 'for-you' });
});

// Measured baselines (+ margin). Update intentionally if the feed's render model changes.
const MAX_INITIAL_COMMITS = 6;
const MAX_COMMITS_PER_TAB_SWITCH = 3;

test('initial feed render commit count stays within baseline', () => {
  const { profiler } = renderWithProfiler(<QuestionsScreen />);
  expect(profiler.commits).toBeLessThanOrEqual(MAX_INITIAL_COMMITS);
  expect(profiler.commits).toBeGreaterThan(0);
});

test('switching a tab stays within the commit baseline', () => {
  const { profiler, getByText } = renderWithProfiler(<QuestionsScreen />);
  const before = profiler.commits;
  fireEvent.press(getByText('Latest'));
  expect(profiler.commits - before).toBeLessThanOrEqual(MAX_COMMITS_PER_TAB_SWITCH);
});
