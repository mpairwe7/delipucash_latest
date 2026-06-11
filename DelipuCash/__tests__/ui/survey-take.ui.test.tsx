/**
 * UI-consistency + a11y regression tests for app/survey/[id].tsx
 * (SurveyAttemptScreen — the respondent survey-taking flow).
 *
 * This is the most complex survey screen: 5 states (success / loading / already-attempted /
 * unavailable / main flow), step navigation, required-field gating, conditional-logic question
 * hiding, and a review→submit→success path. The data-hook surface is mocked; the real
 * SurveyAttemptStore and real conditionalLogic engine drive behaviour. The heavy success overlay
 * and the file-upload question (expo-document-picker) are stubbed so the screen renders in jsdom.
 */
import React from 'react';
import { Alert } from 'react-native';
import { renderWithProviders, screen, fireEvent, act } from '@/test-utils';
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
// Reward honesty: the hero promises the config-driven completion points (what
// submission actually credits), never survey.rewardAmount. Pin the config:
// 10 pts → UGX 400.
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
// expo-document-picker lives behind this — stub so the top-level import doesn't pull native bindings.
jest.mock('@/components/survey/FileUploadQuestion', () => ({
  __esModule: true,
  FileUploadQuestion: () => null,
}));
// The success overlay is confetti/reanimated-heavy and non-deterministic. Stub it to a props
// renderer so the success branch (and the awarded points it receives) can be asserted.
jest.mock('@/components/survey/SurveyCompletionOverlay', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    SurveyCompletionOverlay: ({
      pointsEarned,
      onBackToSurveys,
    }: {
      pointsEarned: number;
      onBackToSurveys: () => void;
    }) =>
      React.createElement(
        TouchableOpacity,
        { accessibilityRole: 'button', accessibilityLabel: 'Back to surveys', onPress: onBackToSurveys },
        React.createElement(Text, null, `Completed: ${pointsEarned} pts`)
      ),
  };
});

import SurveyAttemptScreen from '@/app/survey/[id]';

const mockUseSurvey = useSurvey as jest.Mock;
const mockUseCheckAttempt = useCheckSurveyAttempt as jest.Mock;
const mockUseSubmit = useSubmitSurvey as jest.Mock;

// A submit mutation whose .mutate immediately drives onSuccess with an awarded reward.
const submitMutate = jest.fn((_args: unknown, opts?: { onSuccess?: (d: unknown) => void }) => {
  opts?.onSuccess?.({ pointsAwarded: 500 });
});

// The builder serializes choice options as plain text strings (not {id,text}); the
// respondent submits the option TEXT as the answer, so fixtures use the real shape.
const RADIO_OPTS = JSON.stringify(['Yes', 'No']);

const radio = (overrides = {}) => makeUploadSurvey({ type: 'radio', options: RADIO_OPTS, ...overrides });

/**
 * Set the hook returns, render, and flush the post-mount async effects (the screen reads
 * AccessibilityInfo.isReduceMotionEnabled() and subscribes to Keyboard) inside act().
 */
async function render(detailQuery: ReturnType<typeof makeSurveyDetailQuery>, attempt = makeAttemptStatus()) {
  mockUseSurvey.mockReturnValue(detailQuery);
  mockUseCheckAttempt.mockReturnValue(attempt);
  const utils = renderWithProviders(<SurveyAttemptScreen />);
  await act(async () => {});
  return utils;
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  useSurveyAttemptStore.getState().reset();
  submitMutate.mockClear();
  mockUseSubmit.mockReturnValue({ mutate: submitMutate, isPending: false });
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

describe('SurveyAttemptScreen — states', () => {
  it('shows the loading state while the survey query is pending', async () => {
    await render(makeSurveyDetailQuery(null, { isLoading: true }));
    expect(screen.getByText('Loading survey...')).toBeOnTheScreen();
  });

  it('enforces single-attempt: shows "Already Completed" when the user has attempted', async () => {
    await render(
      makeSurveyDetailQuery(makeSurveyWithQuestions([radio()])),
      makeAttemptStatus({ data: { hasAttempted: true, attemptedAt: '2026-05-20T00:00:00.000Z' } })
    );
    expect(screen.getByText('Already Completed')).toBeOnTheScreen();
    expect(screen.getByText('Browse Other Surveys')).toBeOnTheScreen();
  });

  it('shows the unavailable state on error', async () => {
    await render(makeSurveyDetailQuery(null, { error: new Error('boom') }));
    expect(screen.getByText('Survey unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Go back')).toBeOnTheScreen();
  });

  it('renders the hero, progress, and first question when loaded', async () => {
    await render(makeSurveyDetailQuery(makeSurveyWithQuestions([radio({ id: 'q1', text: 'Q one' })])));
    expect(screen.getByText('Customer satisfaction survey')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Question 1 of 1' })).toBeOnTheScreen();
    expect(screen.getByText('Q one')).toBeOnTheScreen();
    expect(screen.getByText('Required')).toBeOnTheScreen();
  });

  it('promises the config-driven points in the hero, never survey.rewardAmount', async () => {
    await render(makeSurveyDetailQuery(makeSurveyWithQuestions([radio({ id: 'q1', text: 'Q one' })])));
    expect(screen.getByText(/Earn 10 pts/)).toBeOnTheScreen();
    // The factory's rewardAmount (500) must NOT be promised to the respondent.
    expect(screen.queryByText(/Reward:.*500/)).toBeNull();
  });
});

describe('SurveyAttemptScreen — navigation & required gating', () => {
  it('keeps "Next" disabled until a required question is answered, then advances', async () => {
    await render(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([
          radio({ id: 'q1', text: 'Q one' }),
          radio({ id: 'q2', text: 'Q two' }),
        ])
      )
    );

    expect(screen.getByText('Question 1 of 2')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    fireEvent.press(screen.getByRole('radio', { name: 'Yes' }));
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeEnabled();

    fireEvent.press(next);
    expect(screen.getByText('Question 2 of 2')).toBeOnTheScreen();
    // Last question → the affordance becomes Review & Submit.
    expect(screen.getByRole('button', { name: 'Review & Submit' })).toBeOnTheScreen();
    expect(useSurveyAttemptStore.getState().currentQuestionIndex).toBe(1);
  });

  it('treats an optional question as immediately satisfiable', async () => {
    await render(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([makeUploadSurvey({ id: 'q1', text: 'Anything?', type: 'text', required: false })])
      )
    );
    expect(screen.getByText('(Optional)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Review & Submit' })).toBeEnabled();
  });
});

describe('SurveyAttemptScreen — conditional logic (question hiding)', () => {
  it('hides a gated question until its source answer satisfies the rule', async () => {
    await render(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([
          radio({ id: 'q1', text: 'Do you want to add detail?' }),
          makeUploadSurvey({
            id: 'q2',
            text: 'Tell us more',
            type: 'text',
            conditionalLogic: {
              logicType: 'all',
              rules: [{ sourceQuestionId: 'q1', operator: 'equals', value: 'Yes', action: 'show' }],
            },
          }),
        ])
      )
    );

    // q2 is hidden initially — only one visible question.
    expect(screen.getByText('Questions: 1')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Go to question 2')).toBeNull();

    // Answering q1 with "Yes" satisfies the rule and reveals q2.
    fireEvent.press(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByText('Questions: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Go to question 2')).toBeOnTheScreen();
  });

  it('keeps the store question count in sync with the visible set (navigation bound)', async () => {
    await render(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([
          radio({ id: 'q1', text: 'Add detail?' }),
          makeUploadSurvey({
            id: 'q2',
            text: 'Tell us more',
            type: 'text',
            conditionalLogic: {
              logicType: 'all',
              rules: [{ sourceQuestionId: 'q1', operator: 'equals', value: 'Yes', action: 'show' }],
            },
          }),
        ])
      )
    );

    // q2 hidden → store tracks the visible count (1), not the full upload count (2),
    // so goNext/setCurrentIndex cannot overshoot into the hidden question.
    expect(useSurveyAttemptStore.getState().totalQuestions).toBe(1);

    fireEvent.press(screen.getByRole('radio', { name: 'Yes' }));
    expect(useSurveyAttemptStore.getState().totalQuestions).toBe(2);
  });
});

describe('SurveyAttemptScreen — review & submit', () => {
  it('opens the review modal, submits the collected answers, and shows the success overlay', async () => {
    await render(makeSurveyDetailQuery(makeSurveyWithQuestions([radio({ id: 'q1', text: 'Q one' })])));

    fireEvent.press(screen.getByRole('radio', { name: 'Yes' }));
    fireEvent.press(screen.getByRole('button', { name: 'Review & Submit' }));
    expect(screen.getByText('Review your responses')).toBeOnTheScreen();

    // Submit drives onSuccess synchronously, then a modal-close animation flips state async —
    // wrap in act so that trailing update is flushed inside the test.
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Submit survey responses' }));
    });

    expect(submitMutate).toHaveBeenCalledTimes(1);
    // The answer is the option TEXT ("Yes") — not a synthetic "opt_0" id — so it
    // matches conditional-logic rule values and analytics buckets server-side.
    expect(submitMutate.mock.calls[0][0]).toEqual({ surveyId: 's-1', responses: { q1: 'Yes' } });
    // onSuccess → success overlay (stubbed) receives the awarded points.
    expect(screen.getByText('Completed: 500 pts')).toBeOnTheScreen();
  });
});

describe('SurveyAttemptScreen — answer encoding', () => {
  it('submits checkbox answers as an array of option TEXT (not opt_N ids)', async () => {
    await render(
      makeSurveyDetailQuery(
        makeSurveyWithQuestions([
          makeUploadSurvey({
            id: 'q1',
            text: 'Pick colors',
            type: 'checkbox',
            options: JSON.stringify(['Red', 'Green', 'Blue']),
          }),
        ])
      )
    );

    fireEvent.press(screen.getByRole('checkbox', { name: 'Red' }));
    fireEvent.press(screen.getByRole('checkbox', { name: 'Blue' }));
    fireEvent.press(screen.getByRole('button', { name: 'Review & Submit' }));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Submit survey responses' }));
    });

    expect(submitMutate.mock.calls[0][0]).toEqual({
      surveyId: 's-1',
      responses: { q1: ['Red', 'Blue'] },
    });
  });
});
