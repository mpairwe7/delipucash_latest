/**
 * Deterministic fixtures for the video-screen regression suite.
 * Mirrors survey.factory / question.factory; reuses makeUser for the embedded AppUser.
 *
 * Shapes from types/index.ts `Video` and services/videoHooks.ts (useVideoDetails returns a
 * single video; the feed hooks return TanStack infinite-query results of `{ videos, nextPage }`).
 */
import type { Video } from '@/types';
import { makeUser } from '@/__tests__/fixtures/question.factory';

const FIXED = '2026-06-01T09:00:00.000Z';
// A fixed thumbnail URL so VideoCard uses it directly and skips async thumbnail generation.
const THUMB = 'https://cdn.example.com/v/thumb-1.jpg';

export function makeVideo(overrides: Partial<Video> = {}): Video {
  const id = overrides.id ?? 'v-1';
  return {
    id,
    title: 'How to build a regression suite',
    description: 'A short walkthrough.',
    videoUrl: 'https://cdn.example.com/v/clip-1.mp4',
    thumbnail: THUMB,
    userId: 'u-1',
    user: makeUser(),
    likes: 1200,
    views: 34000,
    duration: 180,
    isLiked: false,
    isBookmarked: false,
    commentsCount: 87,
    createdAt: FIXED,
    updatedAt: FIXED,
    ...overrides,
  } as Video;
}

/** A list of videos with distinct ids/titles. */
export function makeVideos(count = 3, overrides: Partial<Video> = {}): Video[] {
  return Array.from({ length: count }, (_, i) =>
    makeVideo({ id: `v-${i + 1}`, title: `Video ${i + 1}`, ...overrides })
  );
}

/** A mock of the `useVideoDetails` query result (single video, with isError). */
export function makeVideoDetailQuery(
  data: Video | null = makeVideo(),
  overrides: Record<string, unknown> = {}
) {
  return { data, isLoading: false, isError: false, error: null, refetch: jest.fn(), ...overrides };
}

/** A flat `useQuery`-shaped result (e.g. useExploreVideos returns `{ data: Video[] }`). */
export function makeVideoQuery(data: Video[] = makeVideos(), overrides: Record<string, unknown> = {}) {
  return { data, isLoading: false, isError: false, error: null, refetch: jest.fn(), ...overrides };
}

/**
 * A mock of a TanStack infinite-query result for a video feed tab — the shape the screen
 * flattens via `data.pages.flatMap(p => p.videos)` (usePersonalizedFeed / useInfiniteTrending /
 * useInfiniteFollowing / useVideoSearchInfinite).
 */
export function makeInfiniteVideoResult(videos: Video[] = makeVideos(), overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ videos, nextPage: null }], pageParams: [1] },
    isLoading: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    isError: false,
    error: null,
    ...overrides,
  };
}
