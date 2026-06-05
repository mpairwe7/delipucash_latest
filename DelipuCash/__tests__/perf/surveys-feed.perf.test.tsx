/**
 * Performance regression guard — SurveysScreen feed (surveys-new.tsx).
 * Commit-count baselines for initial render and a tab switch (mirrors questions-feed).
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProfiler } from '@/test-utils';
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
  useSurveyCreatorAccess: () => ({ canCreateSurvey: true, isLoading: false, subscription: null, refetch: jest.fn() }),
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
    query: '', setQuery: jest.fn(), filteredResults: [], isSearching: false,
    recentSearches: [], removeFromHistory: jest.fn(), clearHistory: jest.fn(),
    submitSearch: jest.fn(), hasNoResults: false,
  }),
}));
jest.mock('@/utils/auth', () => ({
  ...jest.requireActual('@/utils/auth'),
  useAuth: () => ({ isAuthenticated: true, isReady: true, auth: {} }),
  useAuthModal: (selector: (s: { open: () => void; close: () => void }) => unknown) =>
    typeof selector === 'function' ? selector({ open: jest.fn(), close: jest.fn() }) : jest.fn(),
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
jest.mock('@/components/survey', () => ({
  ...jest.requireActual('@/components/survey'),
  SurveyTemplatesGallery: () => null,
  ImportWizard: () => null,
}));

import SurveysScreen from '@/app/(tabs)/surveys-new';

beforeEach(() => {
  (useRunningSurveys as jest.Mock).mockReturnValue(makeSurveyQuery(makeSurveys(3)));
  (useUpcomingSurveys as jest.Mock).mockReturnValue(makeSurveyQuery([]));
  (useCompletedSurveys as jest.Mock).mockReturnValue(makeSurveyQuery([]));
  useSurveyUIStore.setState({ activeTab: 'running' });
});

// Measured baselines (+ margin). Update intentionally if the feed's render model changes.
const MAX_INITIAL_COMMITS = 6;
const MAX_COMMITS_PER_TAB_SWITCH = 3;

test('initial surveys feed render commit count stays within baseline', () => {
  const { profiler } = renderWithProfiler(<SurveysScreen />);
  expect(profiler.commits).toBeLessThanOrEqual(MAX_INITIAL_COMMITS);
  expect(profiler.commits).toBeGreaterThan(0);
});

test('switching a tab stays within the commit baseline', () => {
  const { profiler, getByText } = renderWithProfiler(<SurveysScreen />);
  const before = profiler.commits;
  fireEvent.press(getByText('Completed'));
  expect(profiler.commits - before).toBeLessThanOrEqual(MAX_COMMITS_PER_TAB_SWITCH);
});
