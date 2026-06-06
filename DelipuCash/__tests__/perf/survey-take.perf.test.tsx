/**
 * Performance regression guard — SurveyAttemptScreen (app/survey/[id].tsx).
 * Commit-count baselines for initial render, advancing a question, and per-keystroke typing
 * (the take screen keeps each answer in the SurveyAttemptStore, so a keystroke re-renders the
 * screen). Mirrors perf/question-detail.perf.test.tsx; deterministic, so it runs in test:ci.
 */
import React from 'react';
import { fireEvent, act } from '@testing-library/react-native';
import { renderWithProfiler } from '@/test-utils';
import { useSurvey, useCheckSurveyAttempt, useSubmitSurvey } from '@/services/hooks';
import { useSurveyAttemptStore } from '@/store/SurveyAttemptStore';
import {
  makeSurveyDetailQuery,
  makeSurveyWithQuestions,
  makeUploadSurvey,
  makeAttemptStatus,
} from '@/__tests__/fixtures/survey.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: 's-1' }),
}));
jest.mock('@/services/hooks', () => ({
  ...jest.requireActual('@/services/hooks'),
  useSurvey: jest.fn(),
  useCheckSurveyAttempt: jest.fn(),
  useSubmitSurvey: jest.fn(),
}));
jest.mock('@/utils/auth', () => ({
  ...jest.requireActual('@/utils/auth'),
  useAuth: () => ({ auth: { user: { id: 'u-1' } }, isReady: true }),
}));
jest.mock('@/components/survey/FileUploadQuestion', () => ({
  __esModule: true,
  FileUploadQuestion: () => null,
}));
jest.mock('@/components/survey/SurveyCompletionOverlay', () => ({
  __esModule: true,
  SurveyCompletionOverlay: () => null,
}));

import SurveyAttemptScreen from '@/app/survey/[id]';

const RADIO_OPTS = JSON.stringify([
  { id: 'yes', text: 'Yes' },
  { id: 'no', text: 'No' },
]);

beforeEach(() => {
  useSurveyAttemptStore.getState().reset();
  (useCheckSurveyAttempt as jest.Mock).mockReturnValue(makeAttemptStatus());
  (useSubmitSurvey as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
});

// Measured baselines (+1 margin). Update intentionally if the screen's render model changes.
// Measured: initial mount = 2 commits; answer+advance = 2; per keystroke = 1.
const MAX_INITIAL_COMMITS = 3;
const MAX_COMMITS_PER_NEXT = 3;
const MAX_COMMITS_PER_KEYSTROKE = 2;

test('initial take-screen render commit count stays within baseline', () => {
  (useSurvey as jest.Mock).mockReturnValue(
    makeSurveyDetailQuery(makeSurveyWithQuestions([makeUploadSurvey({ id: 'q1', type: 'radio', options: RADIO_OPTS })]))
  );
  const { profiler } = renderWithProfiler(<SurveyAttemptScreen />);
  expect(profiler.commits).toBeLessThanOrEqual(MAX_INITIAL_COMMITS);
  expect(profiler.commits).toBeGreaterThan(0);
});

test('advancing to the next question stays within the commit baseline', async () => {
  (useSurvey as jest.Mock).mockReturnValue(
    makeSurveyDetailQuery(
      makeSurveyWithQuestions([
        makeUploadSurvey({ id: 'q1', type: 'radio', options: RADIO_OPTS }),
        makeUploadSurvey({ id: 'q2', type: 'radio', options: RADIO_OPTS }),
      ])
    )
  );
  const { profiler, getByRole } = renderWithProfiler(<SurveyAttemptScreen />);
  await act(async () => {}); // settle post-mount async effects

  const before = profiler.commits;
  fireEvent.press(getByRole('radio', { name: 'Yes' }));
  fireEvent.press(getByRole('button', { name: 'Next' }));
  expect(profiler.commits - before).toBeLessThanOrEqual(MAX_COMMITS_PER_NEXT);
});

test('typing into a text question stays within the per-keystroke baseline', async () => {
  (useSurvey as jest.Mock).mockReturnValue(
    makeSurveyDetailQuery(
      makeSurveyWithQuestions([makeUploadSurvey({ id: 'q1', type: 'text', text: 'Your answer' })])
    )
  );
  const { profiler, getByLabelText } = renderWithProfiler(<SurveyAttemptScreen />);
  await act(async () => {});

  const input = getByLabelText('Answer for: Your answer');
  const typed = 'hello';
  const before = profiler.commits;
  for (const ch of typed) {
    fireEvent.changeText(input, ch);
  }
  const perKeystroke = (profiler.commits - before) / typed.length;
  expect(perKeystroke).toBeLessThanOrEqual(MAX_COMMITS_PER_KEYSTROKE);
});
