/**
 * UI-consistency + a11y regression tests for the SurveyCard presentational component
 * (components/cards/SurveyCard.tsx) — the survey feed's list item. No router/data deps,
 * so it's the most stable contract to lock first (analogous to the question ResponseCard).
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { SurveyCard } from '@/components/cards/SurveyCard';
import { makeSurvey } from '@/__tests__/fixtures/survey.factory';

// Pin currency formatting for deterministic snapshots; other assertions don't depend on it.
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  formatCurrency: (n: number) => `UGX ${n}`,
}));

// Reward honesty: respondent-facing cards promise the config-driven completion
// points (what submission actually credits) — never survey.rewardAmount, which
// is the creator's unfunded per-response budget figure. Pin the config so the
// label is deterministic: 10 pts → UGX 400.
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

describe('SurveyCard reward honesty', () => {
  it('promises a respondent the config-driven points, never survey.rewardAmount', () => {
    renderWithProviders(
      <SurveyCard survey={makeSurvey({ rewardAmount: 2000 })} testID="survey-s-1" />
    );
    expect(screen.getByText('+10 pts (~UGX 400)')).toBeOnTheScreen();
    expect(screen.queryByText('UGX 2000')).toBeNull();
  });

  it('keeps showing the configured rewardAmount to the survey OWNER', () => {
    renderWithProviders(
      <SurveyCard survey={makeSurvey({ rewardAmount: 2000 })} isOwner testID="survey-s-1" />
    );
    expect(screen.getByText('UGX 2000')).toBeOnTheScreen();
    expect(screen.queryByText(/\+10 pts/)).toBeNull();
  });
});

describe('SurveyCard', () => {
  it('renders the title with an accessible "Survey:" label and testID', () => {
    renderWithProviders(
      <SurveyCard survey={makeSurvey({ title: 'Customer feedback' })} testID="survey-s-1" />
    );
    expect(screen.getByText('Customer feedback')).toBeOnTheScreen();
    expect(screen.getByLabelText('Survey: Customer feedback')).toBeOnTheScreen();
    expect(screen.getByTestId('survey-s-1')).toBeOnTheScreen();
  });

  it('fires onPress when the card is pressed', () => {
    const onPress = jest.fn();
    renderWithProviders(
      <SurveyCard survey={makeSurvey()} onPress={onPress} testID="survey-s-1" />
    );
    fireEvent.press(screen.getByTestId('survey-s-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes a labelled "view responses" action only for owners', () => {
    const onViewResponses = jest.fn();
    const { rerender } = renderWithProviders(
      <SurveyCard survey={makeSurvey({ title: 'Q3 NPS', totalResponses: 7 })} />
    );
    expect(screen.queryByLabelText(/responses for/)).toBeNull();

    rerender(
      <SurveyCard
        survey={makeSurvey({ title: 'Q3 NPS', totalResponses: 7 })}
        isOwner
        onViewResponses={onViewResponses}
      />
    );
    const viewBtn = screen.getByLabelText('View 7 responses for Q3 NPS');
    // The handler calls e.stopPropagation() to avoid triggering the card's onPress.
    const stopProp = jest.fn();
    fireEvent.press(viewBtn, { stopPropagation: stopProp });
    expect(stopProp).toHaveBeenCalledTimes(1);
    expect(onViewResponses).toHaveBeenCalledTimes(1);
  });
});

describe('SurveyCard snapshots', () => {
  // SurveyCard renders a relative countdown ("N days left") from Date.now(); pin the clock
  // so the snapshots are deterministic across runs.
  beforeAll(() => jest.useFakeTimers({ now: new Date('2026-06-05T12:00:00.000Z') }));
  afterAll(() => jest.useRealTimers());

  it('running variant', () => {
    const { toJSON } = renderWithProviders(
      <SurveyCard survey={makeSurvey()} testID="survey-s-1" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('ended (completed) variant', () => {
    const { toJSON } = renderWithProviders(
      <SurveyCard
        survey={makeSurvey({
          status: 'completed',
          totalResponses: 100,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-03-01T00:00:00.000Z',
        })}
        testID="survey-s-1"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
