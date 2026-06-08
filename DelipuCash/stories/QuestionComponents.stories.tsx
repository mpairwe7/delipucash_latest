import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import {
  ResponseCard,
  QuestionHeroCard,
  QuestionDetailHeader,
  QuestionDetailError,
  AnswerInput,
} from '@/components/question/QuestionDetailLayout';
import { useTheme } from '@/utils/theme';

/**
 * Visual-regression stories for the shared presentational question components.
 * Each story uses fixed props so the rendered pixels are deterministic; Playwright
 * screenshots them (see e2e-visual/question-components.spec.ts).
 */
const meta: Meta = {
  title: 'Question/Presentational',
};
export default meta;

type Story = StoryObj;

const RESPONSE = {
  id: 'r-1',
  userName: 'Ada Lovelace',
  responseText: 'Use React Native Testing Library with the jest-expo preset.',
  createdAt: '2026-06-01T09:00:00.000Z',
  likeCount: 2,
  dislikeCount: 0,
};

const QUESTION = {
  id: 'q-1',
  text: 'How do I write UI regression tests for a React Native screen?',
  category: 'Technology',
  createdAt: '2026-06-01T09:00:00.000Z',
  totalAnswers: 2,
};

// ResponseCard takes `colors` as a prop — read the live (dark) theme.
function ThemedResponseCard(props: Omit<React.ComponentProps<typeof ResponseCard>, 'colors'>) {
  const { colors } = useTheme();
  return <ResponseCard {...props} colors={colors} />;
}

export const ResponseCardDefault: Story = {
  name: 'ResponseCard / default',
  render: () => <ThemedResponseCard response={RESPONSE} onLike={() => {}} onDislike={() => {}} />,
};

export const ResponseCardAccepted: Story = {
  name: 'ResponseCard / accepted',
  render: () => <ThemedResponseCard response={{ ...RESPONSE, isAccepted: true }} />,
};

export const HeroCardNoReward: Story = {
  name: 'QuestionHeroCard / no reward',
  render: () => <QuestionHeroCard question={{ ...QUESTION, rewardAmount: 0 }} />,
};

export const HeroCardWithReward: Story = {
  name: 'QuestionHeroCard / with reward',
  render: () => <QuestionHeroCard question={{ ...QUESTION, rewardAmount: 500 }} />,
};

export const DetailHeader: Story = {
  name: 'QuestionDetailHeader',
  render: () => <QuestionDetailHeader title="Discussion" subtitle="A question?" onBack={() => {}} />,
};

export const DetailError: Story = {
  name: 'QuestionDetailError',
  render: () => <QuestionDetailError message="Question not found" onRetry={() => {}} />,
};

export const AnswerInputFull: Story = {
  name: 'AnswerInput / full',
  render: () => <AnswerInput value="A partial answer" onChangeText={() => {}} onSubmit={() => {}} />,
};

export const AnswerInputCompact: Story = {
  name: 'AnswerInput / compact',
  render: () => (
    <AnswerInput value="A partial answer" onChangeText={() => {}} onSubmit={() => {}} compact />
  ),
};
