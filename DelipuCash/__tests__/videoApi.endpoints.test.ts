/**
 * Comprehensive regression tests for the video screen's frontend endpoint layer
 * (services/videoApi.ts) — the methods the video feed/player call into the backend.
 *
 * Covers the Phase-4 hardening in particular:
 *  - fetchJson defensive parsing (204/empty/non-JSON bodies, network errors)
 *  - auth-token attachment on personalized/list/search/comments/recommended
 *  - follow/block methods that previously used raw fetch with no try/catch
 *  - getByUser pagination derivation (was hardcoded total:0/totalPages:0)
 *  - incrementView tolerant response parsing (no view-count zeroing)
 *  - URL normalization + unplayable-video filtering (getPlayableVideos)
 */

// Controllable auth state for the mocked store (name must start with `mock`).
const mockAuthState: { token: string | null; userId: string | null } = {
  token: 'test-token',
  userId: 'u1',
};

jest.mock('@/utils/auth/store', () => ({
  useAuthStore: {
    getState: () => ({
      auth: mockAuthState.token
        ? { token: mockAuthState.token, user: { id: mockAuthState.userId } }
        : null,
    }),
  },
}));

// videoApi reads the telemetry session id for the view/completion dedup body.
jest.mock('@/services/telemetryApi', () => ({
  telemetry: { getSessionId: () => 'sess-test' },
}));

import { videoApi } from '@/services/videoApi';

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------
type MockResp = { ok: boolean; status: number; text: () => Promise<string> };

const resp = (body?: unknown, opts: { ok?: boolean; status?: number; raw?: string } = {}): MockResp => {
  const { ok = true, status = 200, raw } = opts;
  const textVal = raw !== undefined ? raw : body === undefined ? '' : JSON.stringify(body);
  return { ok, status, text: async () => textVal };
};

const fetchMock = () => global.fetch as unknown as jest.Mock;
const lastCall = () => fetchMock().mock.calls[fetchMock().mock.calls.length - 1];
const lastUrl = (): string => String(lastCall()[0]);
const lastAuthHeader = (): string | undefined => (lastCall()[1]?.headers ?? {}).Authorization;

const video = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  title: 'Vid',
  videoUrl: '/uploads/v.mp4',
  thumbnail: '/uploads/t.jpg',
  likes: 1,
  views: 10,
  ...over,
});

beforeEach(() => {
  mockAuthState.token = 'test-token';
  mockAuthState.userId = 'u1';
  global.fetch = jest.fn().mockResolvedValue(resp({}));
});

afterEach(() => jest.clearAllMocks());

// ===========================================================================
// fetchJson defensive parsing (exercised via thin wrappers like delete/like)
// ===========================================================================
describe('fetchJson defensive parsing', () => {
  it('treats a 204 No Content / empty body as success (DELETE no longer reported as failure)', async () => {
    fetchMock().mockResolvedValueOnce(resp(undefined, { ok: true, status: 204, raw: '' }));
    const r = await videoApi.delete('v1');
    expect(r.success).toBe(true);
  });

  it('returns success:false with the server message on an HTTP error with a JSON body', async () => {
    fetchMock().mockResolvedValueOnce(resp({ message: 'Forbidden' }, { ok: false, status: 403 }));
    const r = await videoApi.delete('v1');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Forbidden');
  });

  it('does not throw on a non-JSON (HTML) error page and includes the status', async () => {
    fetchMock().mockResolvedValueOnce(resp(undefined, { ok: false, status: 502, raw: '<html>Bad Gateway</html>' }));
    const r = await videoApi.delete('v1');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/502/);
  });

  it('maps a network error (fetch rejects) to success:false', async () => {
    fetchMock().mockRejectedValueOnce(new Error('Network down'));
    const r = await videoApi.delete('v1');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Network down/);
  });
});

// ===========================================================================
// Auth-token attachment
// ===========================================================================
describe('auth-token attachment', () => {
  it('attaches the Bearer token on getAll', async () => {
    fetchMock().mockResolvedValueOnce(resp({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }));
    await videoApi.getAll({ page: 1, limit: 10 });
    expect(lastAuthHeader()).toBe('Bearer test-token');
    expect(lastUrl()).toContain('/api/videos/all');
  });

  it('omits Authorization when there is no token', async () => {
    mockAuthState.token = null;
    fetchMock().mockResolvedValueOnce(resp({ data: [] }));
    await videoApi.getAll();
    expect(lastAuthHeader()).toBeUndefined();
  });

  it.each([
    ['getRecommended', () => videoApi.getRecommended(5), '/api/videos/all'],
    ['search', () => videoApi.search('cats'), '/api/videos/all'],
    ['getComments', () => videoApi.getComments('v1'), '/api/videos/v1/comments'],
  ])('attaches the token on %s (Phase 4 personalization fix)', async (_label, call, urlPart) => {
    fetchMock().mockResolvedValueOnce(resp({ data: [] }));
    await call();
    expect(lastAuthHeader()).toBe('Bearer test-token');
    expect(lastUrl()).toContain(urlPart);
  });
});

// ===========================================================================
// like / unlike / bookmark — endpoint + normalization
// ===========================================================================
describe('like / unlike / bookmark', () => {
  it('POSTs to /like and returns the normalized video', async () => {
    fetchMock().mockResolvedValueOnce(resp({ video: video() }));
    const r = await videoApi.like('v1');
    expect(r.success).toBe(true);
    expect(lastUrl()).toContain('/api/videos/v1/like');
    expect(lastCall()[1].method).toBe('POST');
    // relative URLs normalized to absolute
    expect(r.data.videoUrl).toMatch(/^https?:\/\/.+\/uploads\/v\.mp4$/);
  });

  it('POSTs to /unlike', async () => {
    fetchMock().mockResolvedValueOnce(resp({ video: video() }));
    await videoApi.unlike('v1');
    expect(lastUrl()).toContain('/api/videos/v1/unlike');
  });

  it('toggleBookmark hits the /bookmark endpoint', async () => {
    fetchMock().mockResolvedValueOnce(resp({ video: video() }));
    await videoApi.toggleBookmark('v1');
    expect(lastUrl()).toContain('/api/videos/v1/bookmark');
  });
});

// ===========================================================================
// getById — unwrap + not-found guard
// ===========================================================================
describe('getById', () => {
  it('unwraps { data: video } and normalizes', async () => {
    fetchMock().mockResolvedValueOnce(resp({ data: video({ id: 'v9' }) }));
    const r = await videoApi.getById('v9');
    expect(r.success).toBe(true);
    expect(r.data.id).toBe('v9');
    expect(r.data.videoUrl).toMatch(/^https?:\/\//);
  });

  it('returns not-found when the payload has no id', async () => {
    fetchMock().mockResolvedValueOnce(resp({ data: { title: 'no id' } }));
    const r = await videoApi.getById('v9');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });
});

// ===========================================================================
// getByUser pagination derivation (Phase 4 — no hardcoded total:0/totalPages:0)
// ===========================================================================
describe('getByUser pagination', () => {
  it('uses server-provided pagination when present', async () => {
    fetchMock().mockResolvedValueOnce(resp({ videos: [video()], pagination: { page: 2, limit: 10, total: 57, totalPages: 6 } }));
    const r = await videoApi.getByUser('u1', 2, 10);
    expect(r.pagination).toEqual({ page: 2, limit: 10, total: 57, totalPages: 6 });
  });

  it('derives "more pages" when a full page is returned', async () => {
    fetchMock().mockResolvedValueOnce(resp({ videos: [video({ id: 'a' }), video({ id: 'b' }), video({ id: 'c' })] }));
    const r = await videoApi.getByUser('u1', 2, 3);
    expect(r.pagination.totalPages).toBe(3); // page + 1 → there may be more
    expect(r.pagination.total).toBe(3);
  });

  it('derives "last page" when a partial page is returned', async () => {
    fetchMock().mockResolvedValueOnce(resp({ videos: [video({ id: 'a' }), video({ id: 'b' })] }));
    const r = await videoApi.getByUser('u1', 2, 3);
    expect(r.pagination.totalPages).toBe(2); // == page → no more pages
  });
});

// ===========================================================================
// incrementView tolerant parsing (Phase 4 — never zero a real count)
// ===========================================================================
describe('incrementView parsing', () => {
  it.each([
    ['{ video: { views } }', { video: { views: 42 } }, 42],
    ['{ data: { views } }', { data: { views: 7 } }, 7],
    ['{ views }', { views: 99 }, 99],
  ])('reads the count from shape %s', async (_label, body, expected) => {
    fetchMock().mockResolvedValueOnce(resp(body));
    const r = await videoApi.incrementView('v1');
    expect(r.data.views).toBe(expected);
  });

  it('falls back to 0 when no count field is present', async () => {
    fetchMock().mockResolvedValueOnce(resp({ ok: true }));
    const r = await videoApi.incrementView('v1');
    expect(r.data.views).toBe(0);
  });
});

// ===========================================================================
// View/completion dedup carriers — the server dedups per
// (videoId, viewerKey, kind, UTC day); viewerKey prefers the verified token
// user and falls back to this sessionId.
// ===========================================================================
describe('view/completion dedup carriers', () => {
  it('incrementView POSTs the telemetry sessionId and attaches the Bearer token', async () => {
    fetchMock().mockResolvedValueOnce(resp({ success: true, views: 5 }));
    await videoApi.incrementView('v1');

    expect(lastUrl()).toContain('/api/videos/v1/views');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ sessionId: 'sess-test' });
    expect(lastAuthHeader()).toBe('Bearer test-token');
  });

  it('incrementView still works anonymously (no token → no Authorization header)', async () => {
    mockAuthState.token = null;
    fetchMock().mockResolvedValueOnce(resp({ success: true, views: 5 }));
    const r = await videoApi.incrementView('v1');

    expect(lastAuthHeader()).toBeUndefined();
    expect(JSON.parse(lastCall()[1].body)).toEqual({ sessionId: 'sess-test' });
    expect(r.data.views).toBe(5);
  });

  it('recordCompletion POSTs the telemetry sessionId and attaches the Bearer token', async () => {
    fetchMock().mockResolvedValueOnce(resp({ success: true, counted: true }));
    await videoApi.recordCompletion('v1');

    expect(lastUrl()).toContain('/api/videos/v1/completion');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ sessionId: 'sess-test' });
    expect(lastAuthHeader()).toBe('Bearer test-token');
  });
});

// ===========================================================================
// Follow/block methods — error handling (Phase 4 — raw fetch wrapped)
// ===========================================================================
describe('follow / block error handling', () => {
  it('followCreator maps a network error to success:false instead of throwing', async () => {
    fetchMock().mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(videoApi.followCreator('c1')).resolves.toMatchObject({ success: false });
  });

  it('getFollowStatus tolerates a non-JSON body and returns a safe fallback', async () => {
    fetchMock().mockResolvedValueOnce(resp(undefined, { ok: true, status: 200, raw: 'not json' }));
    const r = await videoApi.getFollowStatus('c1');
    expect(r.data).toEqual({ isFollowing: false, notificationsEnabled: false });
  });

  it('getFollowCounts parses a successful response', async () => {
    fetchMock().mockResolvedValueOnce(resp({ success: true, data: { followersCount: 12, followingCount: 3 } }));
    const r = await videoApi.getFollowCounts('u1');
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ followersCount: 12, followingCount: 3 });
  });

  it('followCreator short-circuits without a token (no network call)', async () => {
    mockAuthState.token = null;
    const r = await videoApi.followCreator('c1');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/auth/i);
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// getPlayableVideos — normalization + filtering (via getAll)
// ===========================================================================
describe('getAll → getPlayableVideos', () => {
  it('drops videos with an empty videoUrl and normalizes relative URLs to absolute', async () => {
    fetchMock().mockResolvedValueOnce(
      resp({
        data: [
          video({ id: 'ok', videoUrl: '/uploads/a.mp4' }),
          video({ id: 'empty', videoUrl: '' }),
          video({ id: 'blank', videoUrl: '   ' }),
        ],
        pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
      }),
    );
    const r = await videoApi.getAll();
    expect(r.success).toBe(true);
    expect(r.data.map((v) => v.id)).toEqual(['ok']); // unplayable filtered out
    expect(r.data[0].videoUrl).toMatch(/^https?:\/\/.+\/uploads\/a\.mp4$/);
  });
});
