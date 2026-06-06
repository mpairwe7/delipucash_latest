import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import {
  BarChart,
  PieChart,
  RatingDisplay,
  BooleanChart,
  StatCard,
  WordCloud,
} from '@/components/ui/SurveyCharts';

/**
 * Visual-regression stories for the SurveyCharts presentational components — the survey
 * owner-responses analytics layer (app/survey-responses/[id].tsx). These charts are pure
 * View/Text (no SVG, no animation), so with fixed data they produce deterministic pixel
 * baselines — the survey analog of the committed question presentational baselines.
 */
const meta: Meta = {
  title: 'Survey/Charts',
};
export default meta;

type Story = StoryObj;

const frame = (children: React.ReactNode) => (
  <View style={{ padding: 16, width: 360 }}>{children}</View>
);

export const Bars: Story = {
  name: 'BarChart / categorical',
  render: () =>
    frame(
      <BarChart
        title="Favourite feature"
        data={[
          { label: 'Surveys', value: 42 },
          { label: 'Rewards', value: 31 },
          { label: 'Quizzes', value: 18 },
          { label: 'Live', value: 9 },
        ]}
        showPercentages
      />
    ),
};

export const Pie: Story = {
  name: 'PieChart / donut',
  render: () =>
    frame(
      <PieChart
        title="Plan distribution"
        data={[
          { label: 'Free', value: 60 },
          { label: 'Pro', value: 30 },
          { label: 'Team', value: 10 },
        ]}
        centerText="100"
      />
    ),
};

export const Rating: Story = {
  name: 'RatingDisplay / 5-star',
  render: () =>
    frame(<RatingDisplay average={4.2} distribution={[2, 3, 8, 24, 39]} total={76} />),
};

export const Boolean: Story = {
  name: 'BooleanChart / yes-no',
  render: () => frame(<BooleanChart yesCount={68} noCount={32} />),
};

export const Stat: Story = {
  name: 'StatCard / metric',
  render: () =>
    frame(
      <StatCard label="Completion rate" value="84%" subtext="vs last week" trend="up" trendValue="+6%" />
    ),
};

export const Words: Story = {
  name: 'WordCloud / frequencies',
  render: () =>
    frame(
      <WordCloud
        words={[
          { text: 'fast', count: 24 },
          { text: 'useful', count: 19 },
          { text: 'rewards', count: 14 },
          { text: 'simple', count: 11 },
          { text: 'clear', count: 8 },
          { text: 'fun', count: 5 },
        ]}
      />
    ),
};
