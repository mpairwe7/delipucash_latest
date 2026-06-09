/**
 * UI-consistency + a11y regression tests for app/(tabs)/questions-new.tsx
 * (QuestionsScreen — the main Q&A feed: 5 tabs, infinite scroll, FAB, search).
 *
 * The full hook surface is mocked to benign defaults; useInfiniteQuestionsFeed is driven
 * per state. Gamification/CTA header children and ad components are stubbed to null (they
 * are not under test here), while FeedTabs and QuestionFeedItem stay real so tab structure
 * and question rows are asserted against the genuine components.
 */
import React from 'react';
import { router } from 'expo-router';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { useInfiniteQuestionsFeed } from '@/services/questionHooks';
import { useAuth } from '@/utils/auth/useAuth';
import { useQuestionUIStore } from '@/store';
import { makeInfiniteFeedResult, makeFeedPage, makeFeedQuestion } from '@/__tests__/fixtures/question.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

// Data + aux hooks driven/neutralised.
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
  useAuth: jest.fn(() => ({ isReady: true, isAuthenticated: true })),
}));

// Header gamification/CTA children + ads are out of scope — stub to null.
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

const mockFeed = useInfiniteQuestionsFeed as jest.Mock;

const mockUseAuth = useAuth as jest.Mock;

beforeEach(() => {
  mockFeed.mockReset();
  (router.push as jest.Mock).mockClear();
  mockUseAuth.mockReturnValue({ isReady: true, isAuthenticated: true });
  // Reset the persisted tab selection so each test starts on "For You".
  useQuestionUIStore.setState({ selectedTab: 'for-you' });
});

describe('QuestionsScreen — header & a11y', () => {
  it('renders the header, search, FAB, and a labelled feed list when loaded', () => {
    mockFeed.mockReturnValue(makeInfiniteFeedResult());
    renderWithProviders(<QuestionsScreen />);

    expect(screen.getByText('Questions')).toBeOnTheScreen();
    expect(screen.getByText('Ask, answer, earn')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search questions' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create new question' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Questions feed')).toBeOnTheScreen();
    // First question row from the fixture page.
    expect(screen.getByTestId('question-q-1')).toBeOnTheScreen();
  });
});

describe('QuestionsScreen — feed states', () => {
  it('shows the empty state with an "Ask a Question" CTA', () => {
    mockFeed.mockReturnValue(
      makeInfiniteFeedResult({ data: { pages: [makeFeedPage(0)], pageParams: [1] } })
    );
    renderWithProviders(<QuestionsScreen />);
    expect(screen.getByText('No questions yet')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ask a Question' })).toBeOnTheScreen();
  });

  it('shows the error state and retries the feed on "Try Again"', () => {
    const refetch = jest.fn();
    mockFeed.mockReturnValue(
      makeInfiniteFeedResult({
        data: undefined,
        isError: true,
        error: new Error('Network down'),
        refetch,
      })
    );
    renderWithProviders(<QuestionsScreen />);
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();
    expect(screen.getByText('Network down')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Try Again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('does not render question rows while the feed is loading', () => {
    mockFeed.mockReturnValue(makeInfiniteFeedResult({ data: undefined, isLoading: true }));
    renderWithProviders(<QuestionsScreen />);
    expect(screen.queryByTestId('question-q-1')).toBeNull();
    expect(screen.getByText('Questions')).toBeOnTheScreen();
  });
});

describe('QuestionsScreen — tabs', () => {
  it('renders all five feed tabs', () => {
    mockFeed.mockReturnValue(makeInfiniteFeedResult());
    renderWithProviders(<QuestionsScreen />);
    for (const label of ['For You', 'Latest', 'Unanswered', 'Rewards', 'My Activity']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('switches the active tab and refetches the feed for that tab', () => {
    mockFeed.mockReturnValue(makeInfiniteFeedResult());
    renderWithProviders(<QuestionsScreen />);

    fireEvent.press(screen.getByText('Latest'));

    expect(useQuestionUIStore.getState().selectedTab).toBe('latest');
    // The feed hook is re-invoked with the new tab id on re-render.
    expect(mockFeed.mock.calls.some((call) => call[0] === 'latest')).toBe(true);
  });

  it('gates the "My Activity" tab behind auth for logged-out users', () => {
    mockUseAuth.mockReturnValue({ isReady: true, isAuthenticated: false });
    mockFeed.mockReturnValue(makeInfiniteFeedResult());
    renderWithProviders(<QuestionsScreen />);

    fireEvent.press(screen.getByText('My Activity'));

    // Routes to login and does NOT switch into the user-scoped tab.
    expect(router.push).toHaveBeenCalledWith('/(auth)/login');
    expect(useQuestionUIStore.getState().selectedTab).toBe('for-you');
  });
});

describe('QuestionsScreen — Phase 3 feed polish', () => {
  it('shows the "You\'re all caught up" end-of-list marker when there are no more pages', () => {
    // makeInfiniteFeedResult defaults hasNextPage:false with a populated page.
    mockFeed.mockReturnValue(makeInfiniteFeedResult());
    renderWithProviders(<QuestionsScreen />);
    expect(screen.getByText(/all caught up/i)).toBeOnTheScreen();
  });

  it('abbreviates large counts and shows an "Answered" chip from userHasResponded', () => {
    const answered = makeFeedQuestion({
      id: 'q-1',
      upvotes: 1500,
      totalAnswers: 2000,
      userHasResponded: true,
    });
    mockFeed.mockReturnValue(
      makeInfiniteFeedResult({
        data: { pages: [makeFeedPage(1, { questions: [answered] })], pageParams: [1] },
      })
    );
    renderWithProviders(<QuestionsScreen />);

    // K/M abbreviation on the vote count + answers count (raw 1500/2000 would be "1500"/"2000").
    expect(screen.getAllByText('1.5K').length).toBeGreaterThan(0);
    expect(screen.getByText(/2\.0K\s+answers/)).toBeOnTheScreen();
    // Already-answered affordance (queried by its unique chip label).
    expect(screen.getByLabelText('You answered this')).toBeOnTheScreen();
  });
});
