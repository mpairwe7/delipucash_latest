/**
 * UI-consistency + a11y regression tests for app/video/[id].tsx
 * (VideoDeepLinkScreen — the `delipucash://video/{id}` deep-link / universal-link target).
 *
 * The data layer is mocked: useVideoDetails drives loading / not-found / loaded. The heavy
 * full-screen VideoPlayer is stubbed to a marker so the loaded branch is assertable without
 * pulling expo-video. The real VideoFeedStore supplies liked state. Mirrors question-detail.
 */
import React from 'react';
import { renderWithProviders, screen } from '@/test-utils';
import { useVideoDetails, useLikeVideo } from '@/services/videoHooks';
import { useVideoFeedStore } from '@/store/VideoFeedStore';
import { makeVideo, makeVideoDetailQuery } from '@/__tests__/fixtures/video.factory';

jest.mock('expo-router', () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 'v-1' }),
}));
jest.mock('@/services/videoHooks', () => ({
  ...jest.requireActual('@/services/videoHooks'),
  useVideoDetails: jest.fn(),
  useLikeVideo: jest.fn(),
}));
// Stub only the export the screen uses, so the heavy @/components/video barrel (expo-video,
// VerticalVideoFeed, gesture players) is never loaded.
jest.mock('@/components/video', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    VideoPlayer: (props: { videoDetails?: { title?: string | null } }) =>
      React.createElement(Text, { testID: 'video-player' }, `Player: ${props.videoDetails?.title ?? ''}`),
  };
});

import VideoDeepLinkScreen from '@/app/video/[id]';

const mockUseDetails = useVideoDetails as jest.Mock;

beforeEach(() => {
  useVideoFeedStore.getState().reset();
  (useLikeVideo as jest.Mock).mockReturnValue({ mutate: jest.fn() });
});

describe('VideoDeepLinkScreen — states', () => {
  it('shows the loading state while the video query is pending', () => {
    mockUseDetails.mockReturnValue(makeVideoDetailQuery(null, { isLoading: true }));
    renderWithProviders(<VideoDeepLinkScreen />);
    expect(screen.getByText('Loading video...')).toBeOnTheScreen();
  });

  it('shows a not-found state with recovery actions on error', () => {
    mockUseDetails.mockReturnValue(makeVideoDetailQuery(null, { isError: true }));
    renderWithProviders(<VideoDeepLinkScreen />);
    expect(screen.getByText('Video not found')).toBeOnTheScreen();
    expect(screen.getByText('Browse Videos')).toBeOnTheScreen();
    expect(screen.getByText('Go Back')).toBeOnTheScreen();
  });

  it('renders the full-screen player when the video loads', () => {
    mockUseDetails.mockReturnValue(makeVideoDetailQuery(makeVideo({ title: 'Deep linked clip' })));
    renderWithProviders(<VideoDeepLinkScreen />);
    expect(screen.getByTestId('video-player')).toBeOnTheScreen();
    expect(screen.getByText('Player: Deep linked clip')).toBeOnTheScreen();
  });
});
