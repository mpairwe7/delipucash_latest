/**
 * Tests for the optimistic response like/dislike helpers and mutation wiring
 * (services/hooks.ts). Locks in:
 * - counts update under BOTH field spellings (backend likeCount / legacy likesCount)
 * - setting a reaction clears the opposite one; un-setting only decrements
 * - no-op intents (double-fire) don't drift counts
 * - the updater handles detail `{responses}`, bare arrays, and passes through
 *   unrelated shapes
 * - useLikeResponse rolls the caches back when the request fails
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createProvidersWrapper, createTestQueryClient } from '@/test-utils';
import {
  applyResponseReaction,
  makeResponseReactionUpdater,
  useLikeResponse,
} from '@/services/hooks';
import { questionQueryKeys } from '@/services/questionHooks';
import api from '@/services/api';

const resp = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  responseText: `text ${id}`,
  likeCount: 5,
  dislikeCount: 2,
  isLiked: false,
  isDisliked: false,
  ...extra,
});

describe('applyResponseReaction', () => {
  it('increments likes under both field spellings and sets isLiked', () => {
    const next = applyResponseReaction(resp('r1'), { isLiked: true });
    expect(next).toMatchObject({ likeCount: 6, likesCount: 6, isLiked: true });
    expect(next.dislikeCount).toBe(2); // untouched
  });

  it('clears an existing dislike when liking', () => {
    const next = applyResponseReaction(
      resp('r1', { isDisliked: true }),
      { isLiked: true },
    );
    expect(next).toMatchObject({
      likeCount: 6,
      isLiked: true,
      dislikeCount: 1,
      dislikesCount: 1,
      isDisliked: false,
    });
  });

  it('decrements on un-like and floors at zero', () => {
    const next = applyResponseReaction(
      resp('r1', { isLiked: true, likeCount: 0 }),
      { isLiked: false },
    );
    expect(next).toMatchObject({ likeCount: 0, isLiked: false });
  });

  it('is a no-op when already in the intended state (double-fire safe)', () => {
    const next = applyResponseReaction(resp('r1', { isLiked: true }), { isLiked: true });
    expect(next.likeCount).toBe(5);
  });

  it('reads legacy likesCount when backend likeCount is absent', () => {
    const legacy = { id: 'r1', likesCount: 3, dislikesCount: 1, isLiked: false };
    const next = applyResponseReaction(legacy, { isLiked: true });
    expect(next).toMatchObject({ likeCount: 4, likesCount: 4 });
  });
});

describe('makeResponseReactionUpdater', () => {
  const update = makeResponseReactionUpdater('r2', { isDisliked: true });

  it('updates the matching response inside a detail cache ({responses})', () => {
    const detail = { id: 'q1', text: 'question', responses: [resp('r1'), resp('r2')] };
    const next = update(detail);
    expect(next.responses[1]).toMatchObject({ dislikeCount: 3, isDisliked: true });
    expect(next.responses[0].dislikeCount).toBe(2); // sibling untouched
    expect(next.text).toBe('question');
  });

  it('updates a bare response array', () => {
    const next = update([resp('r2')]);
    expect(next[0]).toMatchObject({ dislikeCount: 3, isDisliked: true });
  });

  it('passes through unrelated shapes and missing caches', () => {
    const stats = { totalAnswered: 4 };
    expect(update(stats)).toBe(stats);
    expect(update(undefined)).toBeUndefined();
    expect(update(null)).toBeNull();
  });
});

describe('useLikeResponse (mutation wiring)', () => {
  let likeSpy: jest.SpyInstance;

  afterEach(() => likeSpy?.mockRestore());

  it('bumps the detail cache optimistically and rolls back on failure', async () => {
    likeSpy = jest.spyOn(api.responses, 'like').mockRejectedValue(new Error('offline'));

    const queryClient = createTestQueryClient();
    const detailKey = questionQueryKeys.detail('q1');
    queryClient.setQueryData(detailKey, {
      id: 'q1',
      responses: [resp('r1')],
    });

    const { result } = renderHook(() => useLikeResponse(), {
      wrapper: createProvidersWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate({ responseId: 'r1', questionId: 'q1', isLiked: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const detail = queryClient.getQueryData<{ responses: any[] }>(detailKey)!;
    expect(detail.responses[0]).toMatchObject({ likeCount: 5, isLiked: false });
    expect(likeSpy).toHaveBeenCalledWith('r1', true);
  });
});
