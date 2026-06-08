import React from 'react';
import { View } from 'react-native';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { VideoCard } from '@/components/cards/VideoCard';
import { VideoFeedSkeleton } from '@/components/video/VideoFeedSkeleton';
import { makeVideo } from '@/__tests__/fixtures/video.factory';

/**
 * Visual-regression stories for the video presentational layer.
 *
 * VideoCard is static once it has a thumbnail (it only animates on press), so with a fixed
 * data-URI thumbnail + fixed counts it yields deterministic pixel baselines — the analog of the
 * SurveyCard baselines. VideoFeedSkeleton uses a looping shimmer, so it's tagged `dynamic`
 * (render smoke-test only, no pixel diff — see e2e-visual/component-stories.spec.ts).
 */
const meta: Meta = {
  title: 'Video/Presentational',
};
export default meta;

type Story = StoryObj;

// 1x1 transparent PNG — loads instantly + identically in the headless browser (no remote fetch),
// so the thumbnail area is deterministic across runs.
const THUMB =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const frame = (children: React.ReactNode, width = 320) => (
  <View style={{ padding: 16, width }}>{children}</View>
);

export const Card: Story = {
  name: 'VideoCard / default',
  render: () =>
    frame(
      <VideoCard
        video={makeVideo({ title: 'How to build a regression suite', thumbnail: THUMB, views: 34000, likes: 1200, commentsCount: 87 })}
        testID="video"
      />
    ),
};

export const Compact: Story = {
  name: 'VideoCard / compact',
  render: () =>
    frame(
      <VideoCard
        video={makeVideo({ title: 'Compact clip', thumbnail: THUMB, views: 5200, likes: 410, commentsCount: 33 })}
        variant="compact"
        testID="video"
      />,
      220
    ),
};

export const Horizontal: Story = {
  name: 'VideoCard / horizontal',
  render: () =>
    frame(
      <VideoCard
        video={makeVideo({ title: 'A wider, list-style video row', thumbnail: THUMB, views: 980, likes: 64 })}
        variant="horizontal"
        testID="video"
      />,
      360
    ),
};

export const Skeleton: Story = {
  name: 'VideoFeedSkeleton',
  tags: ['dynamic'], // looping shimmer → render smoke only, not pixel-diffed
  render: () => (
    <View style={{ width: 360, height: 640 }}>
      <VideoFeedSkeleton count={1} itemHeight={640} />
    </View>
  ),
};
