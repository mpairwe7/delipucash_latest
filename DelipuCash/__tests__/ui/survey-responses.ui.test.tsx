/**
 * UI-consistency + a11y regression tests for app/survey-responses/[id].tsx
 * (SurveyResponsesScreen — the owner-facing response analytics view).
 *
 * Only the aggregate data hook (useSurveyResponseData) is mocked; the real SurveyResponseUIStore
 * (and its pure parse/filter/analytics helpers) drives the view. The chart components are stubbed
 * to inert nodes so the SVG/analytics layer doesn't need a real canvas. Mirrors the question-detail
 * UI test: loading / access-denied / loaded states, the three view tabs, and the empty case.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent, act } from '@/test-utils';
import { useSurveyResponseData } from '@/services/surveyResponseHooks';
import { useSurveyResponseUIStore } from '@/store/SurveyResponseUIStore';
import { makeResponseData, makeSurveyResponses } from '@/__tests__/fixtures/survey.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 's-1' }),
}));
jest.mock('@/services/surveyResponseHooks', () => ({
  ...jest.requireActual('@/services/surveyResponseHooks'),
  useSurveyResponseData: jest.fn(),
}));
jest.mock('@/utils/auth', () => ({
  ...jest.requireActual('@/utils/auth'),
  useAuth: () => ({ auth: { user: { id: 'u-1' } }, isReady: true }),
}));
// Charts render SVG/canvas — stub to inert host nodes so the analytics view renders in jsdom.
jest.mock('@/components/ui/SurveyCharts', () => {
  const React = require('react');
  const Stub = (props: { children?: unknown }) => React.createElement('Chart', props, props?.children);
  return {
    __esModule: true,
    BarChart: Stub,
    BooleanChart: Stub,
    PieChart: Stub,
    RatingDisplay: Stub,
    StatCard: Stub,
    WordCloud: Stub,
    MiniLineChart: Stub,
    default: Stub,
  };
});

import SurveyResponsesScreen from '@/app/survey-responses/[id]';

const mockUseResponseData = useSurveyResponseData as jest.Mock;

async function render(data: ReturnType<typeof makeResponseData>) {
  mockUseResponseData.mockReturnValue(data);
  const utils = renderWithProviders(<SurveyResponsesScreen />);
  await act(async () => {}); // flush post-mount async effects
  return utils;
}

beforeEach(() => {
  useSurveyResponseUIStore.getState().reset();
});

describe('SurveyResponsesScreen — states', () => {
  it('shows the loading state before the survey resolves', async () => {
    await render(makeResponseData({ isLoading: true, survey: undefined }));
    expect(screen.getByText('Loading survey responses...')).toBeOnTheScreen();
  });

  it('shows Access Denied when the viewer is not the owner', async () => {
    await render(makeResponseData({ isError: true, isOwner: false, error: new Error('nope') }));
    expect(screen.getByText('Access Denied')).toBeOnTheScreen();
    expect(screen.getByText('You do not have permission to view these responses.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeOnTheScreen();
  });

  it('renders the header, response count, export action, and view tabs when loaded', async () => {
    await render(makeResponseData({ responses: makeSurveyResponses(3) }));
    expect(screen.getByLabelText('3 responses collected')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Export responses' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeOnTheScreen();
    for (const tab of ['Summary view', 'Questions view', 'Individual view']) {
      expect(screen.getByRole('tab', { name: tab })).toBeOnTheScreen();
    }
  });

  it('shows "0 responses collected" with no responses (no crash)', async () => {
    await render(makeResponseData({ responses: [] }));
    expect(screen.getByLabelText('0 responses collected')).toBeOnTheScreen();
  });
});

describe('SurveyResponsesScreen — view tabs', () => {
  it('switches the active view mode on tab press', async () => {
    await render(makeResponseData({ responses: makeSurveyResponses(2) }));
    expect(useSurveyResponseUIStore.getState().viewMode).toBe('summary');

    fireEvent.press(screen.getByRole('tab', { name: 'Questions view' }));
    expect(useSurveyResponseUIStore.getState().viewMode).toBe('questions');

    fireEvent.press(screen.getByRole('tab', { name: 'Individual view' }));
    expect(useSurveyResponseUIStore.getState().viewMode).toBe('individual');
  });
});
