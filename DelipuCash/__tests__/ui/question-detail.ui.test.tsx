/**
 * UI-consistency + a11y regression tests for app/question-detail.tsx
 * (QuestionCommentsScreen — the FlatList-based "Discussion" view).
 *
 * Only the data layer is mocked: useQuestionDetail / useSubmitQuestionResponse drive the
 * loading / error / empty / loaded states. The toast context has a no-op default (no
 * provider needed) and the like/dislike mutation hooks are inert until pressed, so neither
 * is mocked. requireActual preserves the rest of the questionHooks surface.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import {
  useQuestionDetail,
  useSubmitQuestionResponse,
} from '@/services/questionHooks';
import { useLikeResponse, useDislikeResponse } from '@/services/hooks';
import { makeQuestionDetail } from '@/__tests__/fixtures/question.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 'q-1' }),
}));

jest.mock('@/services/questionHooks', () => ({
  ...jest.requireActual('@/services/questionHooks'),
  useQuestionDetail: jest.fn(),
  useSubmitQuestionResponse: jest.fn(),
}));
jest.mock('@/services/hooks', () => ({
  ...jest.requireActual('@/services/hooks'),
  useLikeResponse: jest.fn(),
  useDislikeResponse: jest.fn(),
}));

// Imported after jest.mock so the default export wiring resolves to the mocked module.
import QuestionCommentsScreen from '@/app/question-detail';

const mockUseQuestionDetail = useQuestionDetail as jest.Mock;
const mockUseSubmit = useSubmitQuestionResponse as jest.Mock;

const QUESTION_TEXT = 'How do I write UI regression tests for a React Native screen?';
const submitMutate = jest.fn();
const likeMutate = jest.fn();
const dislikeMutate = jest.fn();

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
  likeMutate.mockClear();
  dislikeMutate.mockClear();
  mockUseSubmit.mockReturnValue({ mutate: submitMutate, isPending: false });
  (useLikeResponse as jest.Mock).mockReturnValue({ mutate: likeMutate });
  (useDislikeResponse as jest.Mock).mockReturnValue({ mutate: dislikeMutate });
});

describe('QuestionCommentsScreen — states', () => {
  it('shows the skeleton (no header/input) while loading', () => {
    setDetail({ isLoading: true });
    renderWithProviders(<QuestionCommentsScreen />);
    expect(screen.queryByText('Discussion')).toBeNull();
    expect(screen.queryByLabelText('Answer input')).toBeNull();
  });

  it('shows a "Question not found" error with a retry that refetches', () => {
    const refetch = jest.fn();
    setDetail({ error: new Error('boom'), refetch });
    renderWithProviders(<QuestionCommentsScreen />);
    expect(screen.getByText('Question not found')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the discussion, hero question, and response authors when loaded', () => {
    setDetail({ data: makeQuestionDetail() });
    renderWithProviders(<QuestionCommentsScreen />);
    expect(screen.getByText('Discussion')).toBeOnTheScreen();
    expect(screen.getAllByText(QUESTION_TEXT).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Question responses')).toBeOnTheScreen();
    expect(screen.getByText('Ada Lovelace')).toBeOnTheScreen();
    expect(screen.getByText('Alan Turing')).toBeOnTheScreen();
    expect(screen.getByText('Responses')).toBeOnTheScreen();
  });

  it('shows the empty state when there are no responses', () => {
    setDetail({ data: makeQuestionDetail({ responses: [] }) });
    renderWithProviders(<QuestionCommentsScreen />);
    expect(screen.getByText('No responses yet')).toBeOnTheScreen();
  });
});

describe('QuestionCommentsScreen — answer submission', () => {
  it('keeps Send disabled until text is entered, then submits the response', () => {
    setDetail({ data: makeQuestionDetail() });
    renderWithProviders(<QuestionCommentsScreen />);

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Answer input'), 'My considered answer');
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeEnabled();

    fireEvent.press(send);
    expect(submitMutate).toHaveBeenCalledTimes(1);
    expect(submitMutate.mock.calls[0][0]).toEqual({
      questionId: 'q-1',
      responseText: 'My considered answer',
    });
  });
});

describe('QuestionCommentsScreen — like persistence', () => {
  it('sends isLiked:true on the first like and isLiked:false when toggled off', () => {
    setDetail({ data: makeQuestionDetail() });
    renderWithProviders(<QuestionCommentsScreen />);

    // First response's like control. The label embeds the count, so match by prefix and
    // re-query after each press (the count — and thus the label — changes).
    fireEvent.press(screen.getAllByLabelText(/^Like\./)[0]);
    expect(likeMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: 'q-1', isLiked: true })
    );

    fireEvent.press(screen.getAllByLabelText(/^Like\./)[0]);
    expect(likeMutate).toHaveBeenLastCalledWith(
      expect.objectContaining({ questionId: 'q-1', isLiked: false })
    );
  });
});
