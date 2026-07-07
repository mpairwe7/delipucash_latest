/**
 * Tests for the video "instant navigation" layer (services/videoHooks.ts):
 * - findCachedVideo locates a video in every list-shaped cache (infinite
 *   feeds and flat arrays) and skips unrelated shapes — this is what seeds
 *   useVideoDetails' placeholderData when opening video/[id] from a feed.
 * - usePrefetchVideos writes the Following/Trending caches under EXACTLY the
 *   keys the tab hooks read (a key mismatch would make the prefetch useless),
 *   and skips Following for signed-out users.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createProvidersWrapper, createTestQueryClient } from '@/test-utils';
import {
  findCachedVideo,
  usePrefetchVideos,
  useInfiniteTrendingVideos,
  videoQueryKeys,
  TRENDING_FEED_PAGE_LIMIT,
} from '@/services/videoHooks';
import { videoApi } from '@/services/videoApi';
import { useAuthStore } from '@/utils/auth/store';

const vid = (id: string) => ({ id, title: `Video ${id}`, videoUrl: `https://v/${id}.mp4` }) as any;

describe('findCachedVideo', () => {
  it('finds a video inside an infinite-feed cache and inside a flat array cache', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(videoQueryKeys.personalized({ limit: 15 }), {
      pages: [{ videos: [vid('a')], nextPage: 2 }, { videos: [vid('b')], nextPage: null }],
      pageParams: [1, 2],
    });
    queryClient.setQueryData(videoQueryKeys.recommended(), [vid('c')]);

    expect(findCachedVideo(queryClient, 'b')?.id).toBe('b');
    expect(findCachedVideo(queryClient, 'c')?.id).toBe('c');
  });

  it('returns undefined for unknown ids and skips unrelated cache shapes', () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(videoQueryKeys.comments('a'), {
      comments: [{ id: 'not-a-video' }],
      pagination: { total: 1 },
    });
    queryClient.setQueryData(videoQueryKeys.status('a'), { isLiked: true, isBookmarked: false });

    expect(findCachedVideo(queryClient, 'missing')).toBeUndefined();
    expect(findCachedVideo(queryClient, 'not-a-video')).toBeUndefined();
    expect(findCachedVideo(queryClient, '')).toBeUndefined();
  });
});

describe('usePrefetchVideos', () => {
  let trendingSpy: jest.SpyInstance;
  let followingSpy: jest.SpyInstance;
  const authSnapshot = useAuthStore.getState();

  beforeEach(() => {
    trendingSpy = jest.spyOn(videoApi, 'getTrending').mockResolvedValue({
      success: true,
      data: [vid('t1')],
      pagination: { totalPages: 3 },
    } as never);
    followingSpy = jest.spyOn(videoApi, 'getFollowing').mockResolvedValue({
      success: true,
      data: [vid('f1')],
    } as never);
  });

  afterEach(() => {
    trendingSpy.mockRestore();
    followingSpy.mockRestore();
    useAuthStore.setState(authSnapshot, true);
  });

  it('populates the trending cache under the exact key the tab hook reads', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createProvidersWrapper(queryClient);

    const { result } = renderHook(() => usePrefetchVideos(), { wrapper });
    await act(async () => result.current());

    // Read through the REAL tab hook — proves the key matches end-to-end.
    const { result: tab } = renderHook(
      () => useInfiniteTrendingVideos({ limit: TRENDING_FEED_PAGE_LIMIT }),
      { wrapper },
    );
    await waitFor(() => expect(tab.current.isSuccess).toBe(true));
    expect(tab.current.data?.pages[0].videos[0].id).toBe('t1');
    // The tab render consumed the prefetched cache — no second network call.
    expect(trendingSpy).toHaveBeenCalledTimes(1);
  });

  it('prefetches Following only when signed in (mirrors the tab enabled gate)', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createProvidersWrapper(queryClient);

    useAuthStore.setState({ auth: null } as never);
    const { result } = renderHook(() => usePrefetchVideos(), { wrapper });
    await act(async () => result.current());
    expect(followingSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(videoQueryKeys.following())).toBeUndefined();

    useAuthStore.setState({ auth: { user: { id: 'u1' }, token: 'tkn' } } as never);
    await act(async () => result.current());
    await waitFor(() =>
      expect(queryClient.getQueryData(videoQueryKeys.following())).toBeDefined(),
    );
    expect(followingSpy).toHaveBeenCalledTimes(1);
  });
});
