/**
 * Regression tests for createResponse (POST /api/questions/:questionId/responses).
 *
 * Locks the contract the mobile client now depends on:
 *  - already-answered returns 409 with a STABLE `code: 'ALREADY_RESPONDED'` (so the
 *    client detects it without matching the human-readable message text).
 *  - a successful response carries `rewardEarned` (points credited for answering).
 *
 * The controller imports a real Prisma singleton (throws without DATABASE_URL) and the
 * SSE event bus, so we stub them via bun's mock.module BEFORE importing the controller.
 */
import { test, expect, mock } from 'bun:test';

const prismaMock = {
  question: { findUnique: mock(async () => ({ id: 'q-1', rewardAmount: 0, isInstantReward: false, userId: 'owner' })) },
  response: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: 'r-new', createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'), user: { id: 'u-1' } })),
  },
  appUser: { update: mock(async () => ({})) },
};

mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));
mock.module('../lib/eventBus.mjs', () => ({ publishEvent: async () => {} }));
mock.module('../lib/queryStrategies.mjs', () => ({ buildOptimizedQuery: () => ({}) }));

const { createResponse } = await import('../controllers/questionController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('createResponse returns 409 with the ALREADY_RESPONDED code when the user already answered', async () => {
  prismaMock.question.findUnique = mock(async () => ({ id: 'q-1', rewardAmount: 0, isInstantReward: false, userId: 'owner' }));
  prismaMock.response.findFirst = mock(async () => ({ id: 'r-exists' }));

  const req = { params: { questionId: 'q-1' }, body: { responseText: 'hi', userId: 'u-1' } };
  const res = makeRes();
  await createResponse(req, res, () => {});

  expect(res.statusCode).toBe(409);
  expect(res.body.success).toBe(false);
  expect(res.body.code).toBe('ALREADY_RESPONDED');
});

test('createResponse succeeds with rewardEarned when a reward applies and the answerer is not the owner', async () => {
  prismaMock.question.findUnique = mock(async () => ({ id: 'q-1', rewardAmount: 50, isInstantReward: false, userId: 'owner' }));
  prismaMock.response.findFirst = mock(async () => null);

  const req = { params: { questionId: 'q-1' }, body: { responseText: 'a real answer', userId: 'u-1' } };
  const res = makeRes();
  await createResponse(req, res, () => {});

  expect(res.statusCode).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.rewardEarned).toBe(50);
});
