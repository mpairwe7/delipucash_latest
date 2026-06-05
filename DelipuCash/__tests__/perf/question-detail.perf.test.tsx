/**
 * Performance regression guard — QuestionCommentsScreen (question-detail.tsx).
 *
 * Commit-count baselines for (a) initial render and (b) per-keystroke cost while composing
 * an answer. The screen holds draft text in top-level state, so each keystroke re-commits
 * the whole screen incl. the responses FlatList (plan finding #4). The thresholds below are
 * measured baselines + a small margin; a regression that adds commits fails here.
 */
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithProfiler } from '@/test-utils';
import {
  useQuestionDetail,
  useSubmitQuestionResponse,
} from '@/services/questionHooks';
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

import QuestionCommentsScreen from '@/app/question-detail';

beforeEach(() => {
  (useQuestionDetail as jest.Mock).mockReturnValue({
    data: makeQuestionDetail(),
    isLoading: false,
    error: null,
    isFetching: false,
    refetch: jest.fn(),
  });
  (useSubmitQuestionResponse as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
});

// Measured baselines (+ margin). Update intentionally if the screen's render model changes.
const MAX_INITIAL_COMMITS = 4;
const MAX_COMMITS_PER_KEYSTROKE = 1;

test('initial render commit count stays within baseline', () => {
  const { profiler } = renderWithProfiler(<QuestionCommentsScreen />);
  expect(profiler.commits).toBeLessThanOrEqual(MAX_INITIAL_COMMITS);
  expect(profiler.commits).toBeGreaterThan(0);
});

test('typing an answer costs at most one commit per keystroke', () => {
  const { profiler, getByLabelText } = renderWithProfiler(<QuestionCommentsScreen />);
  const input = getByLabelText('Answer input');

  const before = profiler.commits;
  const typed = 'a detailed answer';
  let text = '';
  for (const ch of typed) {
    text += ch;
    fireEvent.changeText(input, text);
  }

  const perKeystroke = (profiler.commits - before) / typed.length;
  expect(perKeystroke).toBeLessThanOrEqual(MAX_COMMITS_PER_KEYSTROKE);
});
