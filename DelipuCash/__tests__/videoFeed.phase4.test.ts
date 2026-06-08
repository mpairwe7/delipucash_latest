/**
 * Phase 4 regression tests — feed integrity + util robustness.
 *
 * 1. setVideos must preserve preload bookkeeping for videos still present and only
 *    prune ids that left the feed. Previously it reset preload on every call, which
 *    effectively disabled preloading because the blended For-You list changes
 *    identity often (watch count, ad spacing).
 * 2. formatFileSize must never emit "NaN B" or negative sizes.
 */
import { useVideoFeedStore } from '@/store/VideoFeedStore';
import { formatFileSize } from '@/utils/video-utils';

const store = () => useVideoFeedStore.getState();

const vid = (id: string) => ({ id, videoUrl: `https://x/${id}.mp4`, title: id } as any);

beforeEach(() => {
  store().reset();
});

describe('VideoFeedStore — setVideos preserves preload state', () => {
  it('keeps preloaded ids that remain in the feed and prunes the rest', () => {
    store().setVideos([vid('a'), vid('b'), vid('c')]);
    store().markPreloaded('a');
    store().markPreloaded('b');
    expect(store().preload.preloadedIds.sort()).toEqual(['a', 'b']);

    // Feed re-renders with a new identity but 'a' and 'b' are still present; 'c'
    // is dropped and 'd' is new.
    store().setVideos([vid('a'), vid('b'), vid('d')]);
    expect(store().preload.preloadedIds.sort()).toEqual(['a', 'b']); // preserved

    // 'a' leaves the feed → its preload entry is pruned.
    store().setVideos([vid('b'), vid('d')]);
    expect(store().preload.preloadedIds).toEqual(['b']);
  });
});

describe('formatFileSize — robust against bad inputs', () => {
  it('formats normal sizes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('clamps negative values to 0 instead of showing "-3.0 KB"', () => {
    expect(formatFileSize(-3072)).toBe('0 B');
  });

  it('returns "0 B" for NaN / non-finite inputs instead of "NaN B"', () => {
    expect(formatFileSize(NaN)).toBe('0 B');
    expect(formatFileSize(Infinity)).toBe('0 B');
  });
});
