/**
 * Phase 1 security regression tests for videoController.
 *
 * Locks the invariants that close the video tamper holes:
 *  - updateVideo / deleteVideo require ownership (or admin/moderator) — previously ANY
 *    authenticated user could update or delete ANY video.
 *  - updateVideo whitelists { title, description } — videoUrl is R2-derived and must not
 *    be rewritable through the API (desyncs r2VideoKey, injection vector).
 *  - deleteVideo removes comments + video in ONE transaction (Comment has no DB cascade)
 *    and best-effort-cleans the R2 objects — an R2 failure never fails the request.
 *  - commentPost enforces the 500-char cap and bounded http(s) media URLs server-side.
 *
 * Prisma is stubbed via bun's mock.module BEFORE importing the controller. r2.mjs is
 * mocked as a FULL spread of the real module (only deleteFile overridden) — a partial
 * mock would drop its other exports for unrelated test files in the same run.
 */
import { test, expect, mock, beforeEach } from 'bun:test';
import * as realR2 from '../lib/r2.mjs';

const txMock = {
  comment: { deleteMany: mock(async () => ({ count: 0 })) },
  video: { delete: mock(async () => ({})) },
};
const prismaMock = {
  video: {
    findUnique: mock(async () => null),
    update: mock(async (args) => ({ id: 'vid-1', ...args.data, createdAt: new Date(), updatedAt: new Date(), user: { id: 'owner', firstName: 'O', lastName: 'W', avatar: null } })),
    delete: mock(async () => ({})),
  },
  comment: {
    deleteMany: mock(async () => ({ count: 0 })),
    create: mock(async () => ({})),
  },
  appUser: {
    findUnique: mock(async () => ({ role: 'USER' })),
  },
  $transaction: mock(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(txMock))),
};

mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));

let deleteFileMock = mock(async () => true);
mock.module('../lib/r2.mjs', () => ({ ...realR2, deleteFile: (...args) => deleteFileMock(...args) }));

const { updateVideo, deleteVideo, commentPost } = await import('../controllers/videoController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const ownedVideo = {
  id: 'vid-1', userId: 'owner', title: 't', description: 'd',
  videoUrl: 'https://cdn/v.mp4', thumbnail: 'https://cdn/t.jpg',
  r2VideoKey: null, r2ThumbnailKey: null,
};

beforeEach(() => {
  prismaMock.video.findUnique = mock(async () => ({ ...ownedVideo }));
  prismaMock.video.update = mock(async (args) => ({
    id: 'vid-1', ...args.data, createdAt: new Date(), updatedAt: new Date(),
    user: { id: 'owner', firstName: 'O', lastName: 'W', avatar: null },
  }));
  prismaMock.video.delete = mock(async () => ({}));
  prismaMock.comment.deleteMany = mock(async () => ({ count: 0 }));
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'USER' }));
  prismaMock.$transaction = mock(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(txMock)));
  deleteFileMock = mock(async () => true);
});

// ---------------------------------------------------------------------------
// updateVideo — ownership + field whitelist
// ---------------------------------------------------------------------------

test('updateVideo rejects a non-owner with 403 and never writes', async () => {
  const res = makeRes();
  await updateVideo(
    { params: { id: 'vid-1' }, body: { title: 'hacked' }, user: { id: 'intruder' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(403);
  expect(prismaMock.video.update.mock.calls.length).toBe(0);
});

test('updateVideo allows the owner and whitelists fields (videoUrl/counters dropped)', async () => {
  let captured;
  prismaMock.video.update = mock(async (args) => {
    captured = args;
    return {
      id: 'vid-1', ...ownedVideo, ...args.data, createdAt: new Date(), updatedAt: new Date(),
      user: { id: 'owner', firstName: 'O', lastName: 'W', avatar: null },
    };
  });

  const res = makeRes();
  await updateVideo(
    {
      params: { id: 'vid-1' },
      body: { title: 'new title', description: 'new desc', videoUrl: 'https://evil/x.mp4', views: 9999, likes: 9999 },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(captured.data).toEqual({ title: 'new title', description: 'new desc' });
});

test('updateVideo allows a MODERATOR who is not the owner', async () => {
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'MODERATOR' }));

  const res = makeRes();
  await updateVideo(
    { params: { id: 'vid-1' }, body: { title: 'moderated' }, user: { id: 'mod-user' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
  expect(prismaMock.video.update.mock.calls.length).toBe(1);
});

test('updateVideo returns 404 when the video does not exist', async () => {
  prismaMock.video.findUnique = mock(async () => null);

  const res = makeRes();
  await updateVideo({ params: { id: 'nope' }, body: { title: 'x' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(404);
});

// ---------------------------------------------------------------------------
// deleteVideo — ownership + transactional delete + R2 cleanup
// ---------------------------------------------------------------------------

test('deleteVideo rejects a non-owner with 403 and never deletes', async () => {
  const res = makeRes();
  await deleteVideo({ params: { id: 'vid-1' }, user: { id: 'intruder' } }, res, () => {});

  expect(res.statusCode).toBe(403);
  expect(prismaMock.$transaction.mock.calls.length).toBe(0);
  expect(prismaMock.video.delete.mock.calls.length).toBe(0);
});

test('deleteVideo deletes comments + video atomically (one transaction)', async () => {
  let deleteManyArgs, deleteArgs;
  prismaMock.comment.deleteMany = mock(async (args) => { deleteManyArgs = args; return { count: 2 }; });
  prismaMock.video.delete = mock(async (args) => { deleteArgs = args; return {}; });

  const res = makeRes();
  await deleteVideo({ params: { id: 'vid-1' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(200);
  expect(prismaMock.$transaction.mock.calls.length).toBe(1);
  expect(deleteManyArgs.where).toEqual({ videoId: 'vid-1' });
  expect(deleteArgs.where).toEqual({ id: 'vid-1' });
});

test('deleteVideo cleans up R2 objects, and an R2 failure does not fail the request', async () => {
  prismaMock.video.findUnique = mock(async () => ({
    ...ownedVideo, r2VideoKey: 'videos/v1.mp4', r2ThumbnailKey: 'thumbs/v1.jpg',
  }));
  const deletedKeys = [];
  deleteFileMock = mock(async (key) => {
    deletedKeys.push(key);
    throw new Error('R2 unavailable'); // cleanup is best-effort
  });

  const res = makeRes();
  await deleteVideo({ params: { id: 'vid-1' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(200);
  expect(res.body.message).toBe('Video deleted successfully');
  expect(deletedKeys).toEqual(['videos/v1.mp4', 'thumbs/v1.jpg']);
});

// ---------------------------------------------------------------------------
// commentPost — server-side input hardening
// ---------------------------------------------------------------------------

test('commentPost rejects text over 500 chars with 400', async () => {
  const res = makeRes();
  await commentPost(
    { params: { id: 'vid-1' }, body: { text: 'x'.repeat(501) }, user: { id: 'commenter' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(400);
  expect(prismaMock.comment.create.mock.calls.length).toBe(0);
});

test('commentPost rejects non-http(s) media URLs with 400', async () => {
  const res = makeRes();
  await commentPost(
    { params: { id: 'vid-1' }, body: { text: 'hi', media: ['javascript:alert(1)'] }, user: { id: 'commenter' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(400);
  expect(prismaMock.comment.create.mock.calls.length).toBe(0);
});

test('commentPost rejects more than 4 media URLs with 400', async () => {
  const res = makeRes();
  await commentPost(
    {
      params: { id: 'vid-1' },
      body: { text: 'hi', media: Array.from({ length: 5 }, (_, i) => `https://cdn/m${i}.jpg`) },
      user: { id: 'commenter' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(400);
  expect(prismaMock.comment.create.mock.calls.length).toBe(0);
});

test('commentPost accepts a comment at the limits (500 chars, 4 valid URLs)', async () => {
  // Commenter == video owner so the SSE owner-notification path is skipped.
  prismaMock.appUser.findUnique = mock(async () => ({ id: 'owner' }));
  prismaMock.comment.create = mock(async (args) => ({
    id: 'c-1', text: args.data.text, mediaUrls: args.data.mediaUrls,
    userId: args.data.userId, videoId: args.data.videoId, createdAt: new Date(),
    user: { id: 'owner', firstName: 'O', lastName: 'W', avatar: null },
  }));

  const res = makeRes();
  await commentPost(
    {
      params: { id: 'vid-1' },
      body: { text: 'x'.repeat(500), media: Array.from({ length: 4 }, (_, i) => `https://cdn/m${i}.jpg`) },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(201);
  expect(prismaMock.comment.create.mock.calls.length).toBe(1);
});
