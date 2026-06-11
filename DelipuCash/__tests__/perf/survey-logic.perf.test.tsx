/**
 * Perf regression lock: typing must not re-evaluate conditional logic.
 *
 * visibleQuestions used to depend on the WHOLE answers map, so every keystroke
 * into ANY question re-filtered all questions and re-ran every rule (O(n×rules)
 * per keystroke). It is now keyed on buildLogicAnswersKey(answers, sourceIds) —
 * only answers to rule-SOURCE questions can trigger evaluation.
 *
 * The existing commit-count baseline (survey-take.perf.test.tsx) CANNOT catch
 * this: commits stay constant either way and its fixture has no logic. This
 * test counts evaluateConditions calls directly via a spy.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent, act } from '@/test-utils';
import { useSurvey, useCheckSurveyAttempt, useSubmitSurvey } from '@/services/hooks';
import { useSurveyAttemptStore } from '@/store/SurveyAttemptStore';
import * as conditionalLogic from '@/utils/conditionalLogic';
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

import SurveyAttemptScreen from '@/app/survey/[id]';

const mockUseSurvey = useSurvey as jest.Mock;
const mockUseCheckAttempt = useCheckSurveyAttempt as jest.Mock;
const mockUseSubmit = useSubmitSurvey as jest.Mock;

const RADIO_OPTS = JSON.stringify(['Yes', 'No']);

describe('conditional-logic evaluation cost', () => {
  let evalSpy: jest.SpyInstance;

  beforeEach(() => {
    useSurveyAttemptStore.getState().reset();
    mockUseSubmit.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseCheckAttempt.mockReturnValue(makeAttemptStatus());
    evalSpy = jest.spyOn(conditionalLogic, 'evaluateConditions');
  });
  afterEach(() => evalSpy.mockRestore());

  it('typing into a NON-source question performs ZERO rule evaluations', async () => {
    mockUseSurvey.mockReturnValue(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([
          makeUploadSurvey({ id: 'q1', text: 'Do you drive?', type: 'radio', options: RADIO_OPTS }),
          makeUploadSurvey({ id: 'q2', text: 'Tell us more', type: 'text', options: '[]', required: false }),
          makeUploadSurvey({
            id: 'q3',
            text: 'Which car?',
            type: 'text',
            options: '[]',
            required: false,
            conditionalLogic: {
              logicType: 'all',
              rules: [{ sourceQuestionId: 'q1', operator: 'equals', value: 'Yes', action: 'show' }],
            },
          }),
        ])
      )
    );

    renderWithProviders(<SurveyAttemptScreen />);
    await act(async () => {});

    // Answering the SOURCE question must evaluate (visibility can change).
    evalSpy.mockClear();
    fireEvent.press(screen.getByText('Yes'));
    await act(async () => {});
    expect(evalSpy.mock.calls.length).toBeGreaterThan(0);

    // Advance to q2 (the non-source free-text question).
    fireEvent.press(screen.getByText('Next'));
    await act(async () => {});
    expect(screen.getByText('Tell us more')).toBeOnTheScreen();

    // Typing into the non-source question must evaluate NOTHING.
    evalSpy.mockClear();
    const input = screen.getByPlaceholderText('Type your answer');
    fireEvent.changeText(input, 'a');
    fireEvent.changeText(input, 'ab');
    fireEvent.changeText(input, 'abc');
    await act(async () => {});
    expect(evalSpy.mock.calls.length).toBe(0);
  });
});
