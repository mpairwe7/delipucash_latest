/**
 * UI-consistency + a11y regression tests for app/(tabs)/surveys-new.tsx
 * (SurveysScreen — the surveys feed: 5 tabs, running/upcoming/completed queries, ads,
 * search, FAB). Mirrors the questions-new feed test.
 *
 * The hook surface is mocked to benign defaults; the three list queries are driven per
 * state. Payment/ads/heavy survey modals are stubbed; SurveyCard + skeleton stay real.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import {
  useRunningSurveys,
  useUpcomingSurveys,
  useCompletedSurveys,
} from '@/services/hooks';
import { useSurveyUIStore } from '@/store/SurveyUIStore';
import { makeSurveys, makeSurveyQuery } from '@/__tests__/fixtures/survey.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/hooks', () => ({
  ...jest.requireActual('@/services/hooks'),
  useRunningSurveys: jest.fn(),
  useUpcomingSurveys: jest.fn(),
  useCompletedSurveys: jest.fn(),
}));
jest.mock('@/services/notificationHooks', () => ({
  __esModule: true,
  useUnreadNotificationCount: () => ({ data: 0 }),
}));
jest.mock('@/services/purchasesHooks', () => ({
  __esModule: true,
  useSurveyCreatorAccess: () => ({
    canCreateSurvey: true,
    isLoading: false,
    subscription: null,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/services/useShouldShowAds', () => ({
  __esModule: true,
  useShouldShowAds: () => ({ shouldShowAds: false }),
}));
jest.mock('@/services/adHooksRefactored', () => ({
  __esModule: true,
  useAdsForPlacement: () => ({ data: [], refetch: jest.fn() }),
  useBannerAds: () => ({ data: [], refetch: jest.fn() }),
  useFeaturedAds: () => ({ data: [], refetch: jest.fn() }),
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
jest.mock('@/utils/auth', () => ({
  ...jest.requireActual('@/utils/auth'),
  useAuth: () => ({ isAuthenticated: true, isReady: true, auth: {} }),
  useAuthModal: (selector: (s: { open: () => void; close: () => void }) => unknown) =>
    typeof selector === 'function' ? selector({ open: jest.fn(), close: jest.fn() }) : jest.fn(),
}));
// SurveyCard (kept real) reads the reward config for its honest respondent
// reward label — pin it so card text stays deterministic (10 pts → UGX 400).
jest.mock('@/services/configHooks', () => ({
  ...jest.requireActual('@/services/configHooks'),
  useRewardConfig: () => ({
    data: {
      surveyCompletionPoints: 10,
      pointsToCashNumerator: 2000,
      pointsToCashDenominator: 50,
      minWithdrawalPoints: 50,
      defaultRegularRewardAmount: 200,
      defaultInstantRewardAmount: 500,
      referralBonusPoints: 60,
    },
  }),
}));
jest.mock('@/components/payment', () => {
  const React = require('react');
  const InlinePremiumSection = React.forwardRef(() => null);
  InlinePremiumSection.displayName = 'InlinePremiumSection';
  return { __esModule: true, InlinePremiumSection };
});
jest.mock('@/components/ads', () => ({
  __esModule: true,
  AdPlacementWrapper: ({ children }: { children?: React.ReactNode }) => children ?? null,
  BetweenContentAd: () => null,
  InFeedAd: () => null,
}));
// Keep SurveyCard + SurveyCardSkeleton real; stub the heavy modal/gallery children.
jest.mock('@/components/survey', () => ({
  ...jest.requireActual('@/components/survey'),
  SurveyTemplatesGallery: () => null,
  ImportWizard: () => null,
}));

import SurveysScreen from '@/app/(tabs)/surveys-new';

const mockRunning = useRunningSurveys as jest.Mock;
const mockUpcoming = useUpcomingSurveys as jest.Mock;
const mockCompleted = useCompletedSurveys as jest.Mock;

beforeEach(() => {
  mockRunning.mockReturnValue(makeSurveyQuery([]));
  mockUpcoming.mockReturnValue(makeSurveyQuery([]));
  mockCompleted.mockReturnValue(makeSurveyQuery([]));
  useSurveyUIStore.setState({ activeTab: 'running' });
});

describe('SurveysScreen — header & a11y', () => {
  it('renders the header, search, and feed list', () => {
    mockRunning.mockReturnValue(makeSurveyQuery(makeSurveys(3)));
    renderWithProviders(<SurveysScreen />);
    expect(screen.getByText('Surveys')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search surveys' })).toBeOnTheScreen();
    expect(screen.getByText('Survey 1')).toBeOnTheScreen();
  });
});

describe('SurveysScreen — feed states', () => {
  it('shows the empty state for the active (running) tab', () => {
    mockRunning.mockReturnValue(makeSurveyQuery([]));
    renderWithProviders(<SurveysScreen />);
    expect(screen.getByText('No active surveys')).toBeOnTheScreen();
  });

  it('empty tab offers a cross-tab CTA instead of dead-ending', () => {
    mockRunning.mockReturnValue(makeSurveyQuery([]));
    renderWithProviders(<SurveysScreen />);

    const cta = screen.getByRole('button', { name: 'Browse upcoming surveys' });
    fireEvent.press(cta);
    expect(useSurveyUIStore.getState().activeTab).toBe('upcoming');
  });

  it('does not render survey cards while the active query is loading', () => {
    mockRunning.mockReturnValue(makeSurveyQuery([], { isLoading: true, data: [] }));
    renderWithProviders(<SurveysScreen />);
    expect(screen.queryByText('Survey 1')).toBeNull();
    expect(screen.getByText('Surveys')).toBeOnTheScreen();
  });
});

describe('SurveysScreen — tabs', () => {
  it('renders all five feed tabs', () => {
    renderWithProviders(<SurveysScreen />);
    for (const label of ['My Surveys', 'Discover', 'Active', 'Upcoming', 'Completed']) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it('switches the active tab on press', () => {
    renderWithProviders(<SurveysScreen />);
    fireEvent.press(screen.getByText('Completed'));
    expect(useSurveyUIStore.getState().activeTab).toBe('completed');
  });
});
