/**
 * UI-consistency + a11y regression tests for components/cards/VideoCard.tsx.
 *
 * VideoCard is the presentational video tile (thumbnail + title + view/like/comment counts) in
 * the three variants the app uses (default / compact / horizontal). Mirrors the SurveyCard test:
 * structure, the `Video: <title>` a11y label, press handling, count formatting, + narrow snapshots.
 * Fixtures carry a thumbnail, so the component's async thumbnail loader is a no-op (deterministic).
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import { VideoCard } from '@/components/cards/VideoCard';
import { makeVideo } from '@/__tests__/fixtures/video.factory';

describe('VideoCard — structure & a11y', () => {
  it('renders the title with a labelled, pressable button role', () => {
    renderWithProviders(
      <VideoCard video={makeVideo({ title: 'Intro to testing' })} testID="video" />
    );
    expect(screen.getByText('Intro to testing')).toBeOnTheScreen();
    expect(screen.getByLabelText('Video: Intro to testing')).toBeOnTheScreen();
    expect(screen.getByTestId('video')).toBeOnTheScreen();
  });

  it('invokes onPress when tapped', () => {
    const onPress = jest.fn();
    renderWithProviders(<VideoCard video={makeVideo()} onPress={onPress} testID="video" />);
    fireEvent.press(screen.getByTestId('video'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('formats large view/like counts compactly', () => {
    renderWithProviders(
      <VideoCard video={makeVideo({ views: 34000, likes: 1200, commentsCount: 87 })} />
    );
    expect(screen.getByText('34.0K')).toBeOnTheScreen(); // views
    expect(screen.getByText('1.2K')).toBeOnTheScreen(); // likes
    expect(screen.getByText('87')).toBeOnTheScreen(); // comments
  });
});

describe('VideoCard — variants', () => {
  it('renders the compact variant', () => {
    renderWithProviders(
      <VideoCard video={makeVideo({ title: 'Compact clip' })} variant="compact" testID="video" />
    );
    expect(screen.getByLabelText('Video: Compact clip')).toBeOnTheScreen();
  });

  it('renders the horizontal variant (views + likes only)', () => {
    renderWithProviders(
      <VideoCard video={makeVideo({ title: 'Wide clip', views: 5000, likes: 250 })} variant="horizontal" testID="video" />
    );
    expect(screen.getByLabelText('Video: Wide clip')).toBeOnTheScreen();
    expect(screen.getByText('5.0K')).toBeOnTheScreen();
    expect(screen.getByText('250')).toBeOnTheScreen();
  });
});

describe('VideoCard — snapshots', () => {
  it('matches the default-variant snapshot', () => {
    const { toJSON } = renderWithProviders(
      <VideoCard
        video={makeVideo({ id: 'v-snap', title: 'Snapshot clip', views: 12000, likes: 340, commentsCount: 12 })}
        testID="video"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
