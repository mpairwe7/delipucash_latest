/**
 * Unit tests for the optimistic cache updaters used by useLikeVideo /
 * useBookmarkVideo / useAddVideoComment / useDeleteVideoComment.
 *
 * These pure helpers are the core of the optimistic-update fix. Before the fix,
 * the like/bookmark updater only handled the infinite-feed shape ({pages}) and
 * silently skipped bare-array list caches (trending/recommended/search), while
 * the comment updater assumed only the flat {comments,pagination} shape and
 * corrupted the infinite-comments cache. These tests lock in that EVERY shape is
 * handled correctly and that unrelated shapes pass through untouched.
 */
import {
  makeVideoCacheUpdater,
  makeCommentCacheUpdater,
} from '@/services/videoHooks';

const v = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, likes: 10, isLiked: false, isBookmarked: false, ...extra } as any);

describe('makeVideoCacheUpdater', () => {
  const likeTransform = (isLiked: boolean) => (vid: any) => ({
    ...vid,
    likes: Math.max(0, (vid.likes ?? 0) + (isLiked ? -1 : 1)),
    isLiked: !isLiked,
  });

  it('updates the matching video inside an infinite-feed shape', () => {
    const cache = { pages: [{ videos: [v('a'), v('b')] }, { videos: [v('c')] }], pageParams: [1, 2] };
    const next = makeVideoCacheUpdater('b', likeTransform(false))(cache);
    expect(next.pages[0].videos[1]).toMatchObject({ id: 'b', likes: 11, isLiked: true });
    expect(next.pages[0].videos[0]).toMatchObject({ id: 'a', likes: 10 }); // untouched
  });

  it('updates the matching video inside a flat array cache (trending/recommended/search)', () => {
    const cache = [v('a'), v('b', { likes: 5 })];
    const next = makeVideoCacheUpdater('b', likeTransform(false))(cache);
    expect(next[1]).toMatchObject({ id: 'b', likes: 6, isLiked: true });
    expect(next[0]).toMatchObject({ id: 'a', likes: 10 });
  });

  it('updates a single detail object matched by id', () => {
    const next = makeVideoCacheUpdater('x', likeTransform(false))(v('x'));
    expect(next).toMatchObject({ id: 'x', likes: 11, isLiked: true });
  });

  it('guards against negative like counts on unlike', () => {
    const next = makeVideoCacheUpdater('x', likeTransform(true))(v('x', { likes: 0 }));
    expect(next.likes).toBe(0);
  });

  it('leaves unrelated shapes (comments/status) untouched', () => {
    const comments = { comments: [{ id: 'c1' }], pagination: { total: 1 } };
    const status = { isLiked: true, isBookmarked: false };
    expect(makeVideoCacheUpdater('x', likeTransform(false))(comments)).toBe(comments);
    expect(makeVideoCacheUpdater('x', likeTransform(false))(status)).toBe(status);
    expect(makeVideoCacheUpdater('x', likeTransform(false))(null)).toBeNull();
  });
});

describe('makeCommentCacheUpdater', () => {
  const c = (id: string) => ({ id, text: id } as any);

  it('adds a comment to the first page of an infinite cache only', () => {
    const cache = { pages: [{ comments: [c('c1')] }, { comments: [c('c2')] }], pageParams: [1, 2] };
    const next = makeCommentCacheUpdater({ add: c('new') })(cache);
    expect(next.pages[0].comments.map((x: any) => x.id)).toEqual(['new', 'c1']);
    expect(next.pages[1].comments.map((x: any) => x.id)).toEqual(['c2']); // other pages untouched
  });

  it('removes a comment from every page of an infinite cache', () => {
    const cache = { pages: [{ comments: [c('c1'), c('c2')] }, { comments: [c('c2')] }] };
    const next = makeCommentCacheUpdater({ removeId: 'c2' })(cache);
    expect(next.pages[0].comments.map((x: any) => x.id)).toEqual(['c1']);
    expect(next.pages[1].comments).toEqual([]);
  });

  it('adds to and bumps the total on a flat cache', () => {
    const cache = { comments: [c('c1')], pagination: { total: 1 } };
    const next = makeCommentCacheUpdater({ add: c('new') })(cache);
    expect(next.comments.map((x: any) => x.id)).toEqual(['new', 'c1']);
    expect(next.pagination.total).toBe(2);
  });

  it('removes from and decrements the total on a flat cache (never below 0)', () => {
    const cache = { comments: [c('c1')], pagination: { total: 0 } };
    const next = makeCommentCacheUpdater({ removeId: 'c1' })(cache);
    expect(next.comments).toEqual([]);
    expect(next.pagination.total).toBe(0);
  });

  it('does NOT corrupt an infinite cache (preserves the pages shape)', () => {
    const cache = { pages: [{ comments: [c('c1')] }], pageParams: [1] };
    const next = makeCommentCacheUpdater({ add: c('new') })(cache);
    expect(next.pages).toBeDefined();
    expect(next.comments).toBeUndefined();
  });
});
