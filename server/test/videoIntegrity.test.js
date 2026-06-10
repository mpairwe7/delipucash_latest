/**
 * Phase 2 view-integrity regression tests for videoController.
 *
 * Locks:
 *  - A view logs a deduped VideoViewEvent row + bumps Video.views in ONE transaction;
 *    attribution (userId) comes from the verified token, NOT the request body.
 *  - A duplicate (same viewer, video, kind, UTC day → P2002) is idempotent — the
 *    counter is NOT incremented again, and the endpoint still returns 200.
 *  - Anonymous viewers dedup on the client session id, falling back to an ip+ua hash.
 *  - Completions follow the same dedup with their own kind/counter.
 *  - The views response is slim ({ success, views }) — no signed URLs on the hot path.
 *  - ingestVideoEvents clamps client-controlled sessionId/payload sizes.
 */
import { test, expect, mock, beforeEach } from 'bun:test';

const txMock = {
  videoViewEvent: { create: mock(async () => ({})) },
  video: { update: mock(async () => ({})) },
};
const prismaMock = {
  video: {
    findUnique: mock(async () => ({ id: 'vid-1', views: 7 })),
  },
  videoEvent: {
    createMany: mock(async () => ({ count: 0 })),
  },
  $transaction: mock(async (fn) => fn(txMock)),
};

// Only prisma is mocked — see the note in adSecurity.test.js. A partial r2/memoryCache
// mock would leak (process-global) and drop their other exports for other test files.
mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));

const { incrementVideoViews, recordVideoCompletion, ingestVideoEvents } =
  await import('../controllers/videoController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

beforeEach(() => {
  prismaMock.video.findUnique = mock(async () => ({ id: 'vid-1', views: 7 }));
  prismaMock.videoEvent.createMany = mock(async () => ({ count: 0 }));
  prismaMock.$transaction = mock(async (fn) => fn(txMock));
  txMock.videoViewEvent.create = mock(async () => ({}));
  txMock.video.update = mock(async () => ({}));
});

// ---------------------------------------------------------------------------
// incrementVideoViews — dedup + attribution + slim response
// ---------------------------------------------------------------------------

test('a first view logs a deduped event row + increments, attributed to the TOKEN user', async () => {
  let eventArgs, updateArgs;
  txMock.videoViewEvent.create = mock(async (args) => { eventArgs = args; return {}; });
  txMock.video.update = mock(async (args) => { updateArgs = args; return {}; });

  const res = makeRes();
  await incrementVideoViews(
    {
      params: { id: 'vid-1' },
      body: { sessionId: 'sess-1', userId: 'SPOOFED' },
      user: { id: 'real-user' },
      headers: { 'user-agent': 'bun-test' },
      ip: '1.2.3.4',
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(prismaMock.$transaction.mock.calls.length).toBe(1);
  expect(eventArgs.data.videoId).toBe('vid-1');
  expect(eventArgs.data.kind).toBe('view');
  expect(eventArgs.data.userId).toBe('real-user'); // token, not body.userId === 'SPOOFED'
  expect(eventArgs.data.viewerKey).toBe('real-user'); // verified user wins the dedup key
  // dayBucket is UTC midnight
  expect(eventArgs.data.dayBucket.getUTCHours()).toBe(0);
  expect(eventArgs.data.dayBucket.getUTCMinutes()).toBe(0);
  expect(updateArgs.data.views).toEqual({ increment: 1 });
  // slim response: { success, views } — no signed URLs / full video object
  expect(res.body.success).toBe(true);
  expect(res.body.views).toBe(8);
  expect(res.body.video).toBeUndefined();
});

test('a duplicate view (same viewer/day → P2002) is idempotent — counter NOT incremented', async () => {
  txMock.videoViewEvent.create = mock(async () => {
    const e = new Error('dup'); e.code = 'P2002'; throw e;
  });
  const updateSpy = mock(async () => ({}));
  txMock.video.update = updateSpy;

  const res = makeRes();
  await incrementVideoViews(
    { params: { id: 'vid-1' }, body: { sessionId: 'sess-1' }, user: {}, headers: {}, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(updateSpy.mock.calls.length).toBe(0);
  expect(res.body.views).toBe(7); // unchanged
});

test('an anonymous view dedups on the client session id', async () => {
  let eventArgs;
  txMock.videoViewEvent.create = mock(async (args) => { eventArgs = args; return {}; });

  const res = makeRes();
  await incrementVideoViews(
    { params: { id: 'vid-1' }, body: { sessionId: 'anon-sess' }, headers: {}, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(eventArgs.data.userId).toBe(null);
  expect(eventArgs.data.viewerKey).toBe('s:anon-sess');
});

test('an anonymous view without a session id falls back to an ip+ua hash key', async () => {
  let eventArgs;
  txMock.videoViewEvent.create = mock(async (args) => { eventArgs = args; return {}; });

  const res = makeRes();
  await incrementVideoViews(
    { params: { id: 'vid-1' }, body: {}, headers: { 'user-agent': 'bun-test' }, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(eventArgs.data.viewerKey.startsWith('a:')).toBe(true);
  expect(eventArgs.data.viewerKey.length).toBeGreaterThan(2);
});

test('a missing video returns 404 without recording anything', async () => {
  prismaMock.video.findUnique = mock(async () => null);

  const res = makeRes();
  await incrementVideoViews({ params: { id: 'nope' }, body: {}, headers: {}, ip: '1.2.3.4' }, res, () => {});

  expect(res.statusCode).toBe(404);
  expect(prismaMock.$transaction.mock.calls.length).toBe(0);
});

// ---------------------------------------------------------------------------
// recordVideoCompletion — same dedup, its own kind + counter
// ---------------------------------------------------------------------------

test('a completion logs kind=completion and increments completionsCount', async () => {
  let eventArgs, updateArgs;
  txMock.videoViewEvent.create = mock(async (args) => { eventArgs = args; return {}; });
  txMock.video.update = mock(async (args) => { updateArgs = args; return {}; });

  const res = makeRes();
  await recordVideoCompletion(
    { params: { id: 'vid-1' }, body: { sessionId: 'sess-1' }, user: { id: 'real-user' }, headers: {}, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(eventArgs.data.kind).toBe('completion');
  expect(updateArgs.data.completionsCount).toEqual({ increment: 1 });
  expect(res.body).toMatchObject({ success: true, counted: true });
});

test('a repeat completion (feed fires on every loop end) is absorbed by the dedup', async () => {
  txMock.videoViewEvent.create = mock(async () => {
    const e = new Error('dup'); e.code = 'P2002'; throw e;
  });
  const updateSpy = mock(async () => ({}));
  txMock.video.update = updateSpy;

  const res = makeRes();
  await recordVideoCompletion(
    { params: { id: 'vid-1' }, body: { sessionId: 'sess-1' }, user: {}, headers: {}, ip: '1.2.3.4' },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(updateSpy.mock.calls.length).toBe(0);
  expect(res.body.counted).toBe(false);
});

// ---------------------------------------------------------------------------
// ingestVideoEvents — clamps on client-controlled fields
// ---------------------------------------------------------------------------

test('ingestVideoEvents clamps oversized payloads to {} and long session ids to 128 chars', async () => {
  let captured;
  prismaMock.videoEvent.createMany = mock(async (args) => { captured = args; return { count: 2 }; });

  const res = makeRes();
  await ingestVideoEvents(
    {
      body: {
        sessionId: 's'.repeat(300),
        events: [
          { videoId: 'vid-1', eventType: 'play_3s', payload: { blob: 'x'.repeat(5000) } },
          { videoId: 'vid-1', eventType: 'impression', payload: { ok: true } },
        ],
      },
      headers: {},
    },
    res, () => {},
  );

  expect(res.body).toMatchObject({ success: true, ingested: 2 });
  expect(captured.data[0].payload).toEqual({}); // oversized → dropped, not rejected
  expect(captured.data[1].payload).toEqual({ ok: true });
  expect(captured.data[0].sessionId.length).toBe(128);
});
