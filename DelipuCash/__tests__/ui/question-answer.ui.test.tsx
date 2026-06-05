/**
 * UI-consistency + a11y regression tests for app/question-answer/[id].tsx
 * (QuestionAnswerScreen — the canonical Quora-style answer screen).
 *
 * Its distinct contract vs question-detail: draft text lives in the QuestionAnswerStore
 * (Zustand, session-scoped), the submit affordance is gated by a per-question validity
 * selector, and the responses list is labelled by count. Those are asserted here so the
 * two screens' intentional divergence is locked.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import {
  useQuestionDetail,
  useSubmitQuestionResponse,
} from '@/services/questionHooks';
import { useQuestionAnswerStore } from '@/store';
import { makeQuestionDetail } from '@/__tests__/fixtures/question.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'q-1' }),
}));
jest.mock('@/services/questionHooks', () => ({
  ...jest.requireActual('@/services/questionHooks'),
  useQuestionDetail: jest.fn(),
  useSubmitQuestionResponse: jest.fn(),
}));
jest.mock('@/utils/useUser', () => ({
  __esModule: true,
  default: () => ({ data: { id: 'u-1', firstName: 'Test', lastName: 'User' }, loading: false }),
}));
jest.mock('@/hooks/useQuizAdPlacement', () => ({
  __esModule: true,
  useQuizAdPlacement: () => ({
    postAnswerAd: null,
    shouldShowPostAnswerAd: false,
    recordQuestionAnswered: jest.fn(),
    trackPostAnswerImpression: jest.fn(),
  }),
}));
jest.mock('@/components/ads/PostQuestionAdSlot', () => ({
  __esModule: true,
  PostQuestionAdSlot: () => null,
}));

import QuestionAnswerScreen from '@/app/question-answer/[id]';

const mockUseQuestionDetail = useQuestionDetail as jest.Mock;
const mockUseSubmit = useSubmitQuestionResponse as jest.Mock;
const submitMutate = jest.fn();

function setDetail(overrides: Record<string, unknown> = {}) {
  mockUseQuestionDetail.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  submitMutate.mockClear();
  mockUseSubmit.mockReturnValue({ mutate: submitMutate, isPending: false });
  // Reset the session-scoped draft store so drafts/submissions don't leak between tests.
  useQuestionAnswerStore.setState({ drafts: {}, submittedQuestionIds: new Set() });
});

describe('QuestionAnswerScreen — states', () => {
  it('shows the skeleton (no input) while loading', () => {
    setDetail({ isLoading: true });
    renderWithProviders(<QuestionAnswerScreen />);
    expect(screen.queryByLabelText('Answer text input')).toBeNull();
  });

  it('shows a "Question not found" error with a retry control', () => {
    const refetch = jest.fn();
    setDetail({ data: undefined, error: null, refetch });
    renderWithProviders(<QuestionAnswerScreen />);
    expect(screen.getByText('Question not found')).toBeOnTheScreen();
    expect(screen.getByLabelText('Retry loading question')).toBeOnTheScreen();
  });

  it('renders the responses list (count-labelled) and answer affordances when loaded', () => {
    setDetail({ data: makeQuestionDetail() });
    renderWithProviders(<QuestionAnswerScreen />);
    expect(screen.getByLabelText('2 responses')).toBeOnTheScreen();
    expect(
      screen.getByText('Use React Native Testing Library with the jest-expo preset.')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Snapshot only deterministic presentational subtrees.')
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Answer text input')).toBeOnTheScreen();
    expect(screen.getByLabelText('Open discussion')).toBeOnTheScreen();
  });

  it('labels the responses list "0 responses" when there are none', () => {
    setDetail({ data: makeQuestionDetail({ responses: [] }) });
    renderWithProviders(<QuestionAnswerScreen />);
    expect(screen.getByLabelText('0 responses')).toBeOnTheScreen();
  });
});

describe('QuestionAnswerScreen — draft + submission', () => {
  it('gates submit behind the validity selector, then submits the trimmed draft', () => {
    setDetail({ data: makeQuestionDetail() });
    renderWithProviders(<QuestionAnswerScreen />);

    // Empty draft → submit is the disabled "write an answer" affordance.
    expect(screen.getByLabelText('Write an answer to submit')).toBeOnTheScreen();

    fireEvent.changeText(
      screen.getByLabelText('Answer text input'),
      'This is a sufficiently detailed answer.'
    );

    const submit = screen.getByLabelText('Submit answer');
    expect(submit).toBeEnabled();
    fireEvent.press(submit);

    expect(submitMutate).toHaveBeenCalledTimes(1);
    expect(submitMutate.mock.calls[0][0]).toEqual({
      questionId: 'q-1',
      responseText: 'This is a sufficiently detailed answer.',
    });
  });
});
