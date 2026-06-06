import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SurveyCardSkeleton } from '@/components/survey/SurveySkeletons';

/**
 * Loading-skeleton stories. The skeletons use a looping RN Animated shimmer, so their pixels
 * are non-deterministic at screenshot time — these stories are tagged `dynamic` so the visual
 * spec mounts them as a render smoke-test (catches crashes) but does NOT pixel-diff them.
 */
const meta: Meta = {
  title: 'Survey/Skeletons',
  tags: ['dynamic'],
};
export default meta;

type Story = StoryObj;

export const Card: Story = {
  name: 'SurveyCardSkeleton / detailed',
  render: () => (
    <View style={{ padding: 16, width: 360 }}>
      <SurveyCardSkeleton variant="detailed" />
    </View>
  ),
};
