/**
 * Phase 1 submission-integrity regression tests — the atomic maxResponses guard.
 *
 * Locks:
 *  - maxResponses is ENFORCED (it previously wasn't — a capped survey accepted
 *    unlimited responses until its end date).
 *  - The guard is the ads atomic-spend pattern: cap condition + counter
 *    increment in ONE updateMany inside the submission transaction, so two
 *    racing submissions at capacity cannot both pass.
 *  - Cap reached → 410 SURVEY_FULL, no response row, no points.
 *  - Surveys without a cap still increment the denormalized counter.
 *  - The duplicate-attempt P2002 path still returns 409 (and, being inside the
 *    same transaction, rolls the increment back with everything else).
 */
import { test, expect, mock, beforeEach } from 'bun:test';

const prismaMock = {
  survey: {
    findUnique: mock(async () => null),
    updateMany: mock(async () => ({ count: 1 })),
  },
  surveyResponse: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: 'resp-1', createdAt: new Date('2026-01-01T00:00:00.000Z') })),
    count: mock(async () => 0),
  },
  appUser: { update: mock(async () => ({})) },
  $transaction: mock(async (fn) => fn(prismaMock)),
};

mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));
mock.module('../lib/eventBus.mjs', () => ({ publishEvent: async () => {} }));
mock.module('../lib/webhookDispatcher.mjs', () => ({ dispatchWebhooks: async () => {} }));
mock.module('./paymentController.mjs', () => ({ processMtnPayment: async () => {}, processAirtelPayment: async () => {} }));
mock.module('../controllers/paymentController.mjs', () => ({ processMtnPayment: async () => {}, processAirtelPayment: async () => {} }));
mock.module('./notificationController.mjs', () => ({ createNotificationFromTemplateHelper: async () => {} }));
mock.module('../controllers/notificationController.mjs', () => ({ createNotificationFromTemplateHelper: async () => {} }));
mock.module('../lib/achievementChecker.mjs', () => ({ checkAndUnlockAchievements: async () => {} }));
mock.module('../lib/rewardConfig.mjs', () => ({
  getRewardConfig: async () => ({ surveyCompletionPoints: 10, pointsToCashNumerator: 2000, pointsToCashDenominator: 50 }),
  pointsToUgx: (p, c) => Math.floor((p * c.pointsToCashNumerator) / c.pointsToCashDenominator),
}));

const { submitSurveyResponse } = await import('../controllers/surveyController.mjs');

function makeRes() {
  return {
    statusCode: 0,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const next = (err) => { if (err) throw err; };

const HOUR = 60 * 60 * 1000;
function cappedSurvey(overrides = {}) {
  return {
    id: 's1',
    title: 'Capped survey',
    userId: 'owner',
    maxResponses: 100,
    startDate: new Date(Date.now() - HOUR),
    endDate: new Date(Date.now() + HOUR),
    uploads: [],
    ...overrides,
  };
}

beforeEach(() => {
  prismaMock.survey.findUnique = mock(async () => cappedSurvey());
  prismaMock.survey.updateMany = mock(async () => ({ count: 1 }));
  prismaMock.surveyResponse.findFirst = mock(async () => null);
  prismaMock.surveyResponse.create = mock(async () => ({ id: 'resp-1', createdAt: new Date('2026-01-01T00:00:00.000Z') }));
  prismaMock.surveyResponse.count = mock(async () => 0);
  prismaMock.appUser.update = mock(async () => ({}));
  prismaMock.$transaction = mock(async (fn) => fn(prismaMock));
});

test('the guard carries the cap condition + increment in ONE statement', async () => {
  let captured;
  prismaMock.survey.updateMany = mock(async (args) => { captured = args; return { count: 1 }; });

  const res = makeRes();
  await submitSurveyResponse(
    { params: { surveyId: 's1' }, body: { responses: { q1: 'Yes' } }, user: { id: 'u1' } },
    res, next,
  );

  expect(res.statusCode).toBe(201);
  expect(captured.where).toEqual({ id: 's1', responsesSubmitted: { lt: 100 } });
  expect(captured.data).toEqual({ responsesSubmitted: { increment: 1 } });
});

test('cap reached → 410 SURVEY_FULL, no response row, no points', async () => {
  prismaMock.survey.updateMany = mock(async () => ({ count: 0 })); // guard rejected

  const res = makeRes();
  await submitSurveyResponse(
    { params: { surveyId: 's1' }, body: { responses: { q1: 'Yes' } }, user: { id: 'u1' } },
    res, next,
  );

  expect(res.statusCode).toBe(410);
  expect(res.body.code).toBe('SURVEY_FULL');
  expect(res.body.submitted).toBe(false);
  expect(prismaMock.surveyResponse.create.mock.calls.length).toBe(0);
  expect(prismaMock.appUser.update.mock.calls.length).toBe(0);
});

test('a survey without a cap still increments the counter (no lt condition)', async () => {
  prismaMock.survey.findUnique = mock(async () => cappedSurvey({ maxResponses: null }));
  let captured;
  prismaMock.survey.updateMany = mock(async (args) => { captured = args; return { count: 1 }; });

  const res = makeRes();
  await submitSurveyResponse(
    { params: { surveyId: 's1' }, body: { responses: { q1: 'Yes' } }, user: { id: 'u1' } },
    res, next,
  );

  expect(res.statusCode).toBe(201);
  expect(captured.where).toEqual({ id: 's1' });
  expect(captured.data).toEqual({ responsesSubmitted: { increment: 1 } });
});

test('duplicate-attempt race (P2002) still returns 409 from inside the guarded transaction', async () => {
  prismaMock.surveyResponse.create = mock(async () => {
    const e = new Error('dup'); e.code = 'P2002'; throw e;
  });

  const res = makeRes();
  await submitSurveyResponse(
    { params: { surveyId: 's1' }, body: { responses: { q1: 'Yes' } }, user: { id: 'u1' } },
    res, next,
  );

  expect(res.statusCode).toBe(409);
  expect(res.body.alreadyAttempted).toBe(true);
});

test('points are still credited atomically on success (201 carries the reward fields)', async () => {
  const res = makeRes();
  await submitSurveyResponse(
    { params: { surveyId: 's1' }, body: { responses: { q1: 'Yes' } }, user: { id: 'u1' } },
    res, next,
  );

  expect(res.statusCode).toBe(201);
  expect(res.body.pointsAwarded).toBe(10);
  expect(res.body.cashEquivalent).toBe(400);
  expect(prismaMock.appUser.update.mock.calls[0][0]).toEqual({
    where: { id: 'u1' },
    data: { points: { increment: 10 } },
  });
});
