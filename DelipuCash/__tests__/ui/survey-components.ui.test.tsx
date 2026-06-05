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
    fireEvent.press(viewBtn, { stopPropagation: jest.fn() });
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
