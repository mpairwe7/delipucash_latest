import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SurveyCard } from '@/components/cards/SurveyCard';
import { makeSurvey } from '@/__tests__/fixtures/survey.factory';

/**
 * Visual-regression stories for the SurveyCard presentational component.
 *
 * SurveyCard renders a relative countdown from Date.now(), which would make a pixel baseline
 * drift daily. The stories therefore use ENDED surveys (past endDate) so the card renders the
 * static "Ended" state — deterministic without injecting a fake clock into the browser.
 */
const meta: Meta = {
  title: 'Survey/Presentational',
};
export default meta;

type Story = StoryObj;

const endedBase = {
  status: 'completed' as const,
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-03-01T00:00:00.000Z',
};

export const SurveyCardEndedReward: Story = {
  name: 'SurveyCard / ended (reward)',
  render: () => (
    <SurveyCard
      survey={makeSurvey({ ...endedBase, title: 'Customer satisfaction survey', totalResponses: 100, rewardAmount: 500 })}
      testID="survey"
    />
  ),
};

export const SurveyCardEndedNoReward: Story = {
  name: 'SurveyCard / ended (no reward)',
  render: () => (
    <SurveyCard
      survey={makeSurvey({ ...endedBase, title: 'Product feedback', totalResponses: 42, rewardAmount: 0 })}
      testID="survey"
    />
  ),
};
