/**
 * Regression tests for submitSurveyResponse (POST /api/surveys/:surveyId/responses).
 *
 * Validates the request/response CONTRACT and the answer-handling BEHAVIOUR the mobile
 * client depends on:
 *   - status codes + JSON shape for each guard (auth, empty body, not-found, window, dup)
 *   - required-question validation respects conditional-logic visibility
 *   - answer VALUES are stored verbatim (no option-membership validation) — this is why
 *     the client must submit the option TEXT so it matches rule values + analytics buckets
 *   - success response carries pointsAwarded + cashEquivalent and persists JSON.stringify(responses)
 *   - single-attempt idempotency (pre-check 409 and P2002 race 409)
 *
 * The controller imports a real Prisma singleton (which throws without DATABASE_URL) plus
 * several fire-and-forget side-effect modules, so we stub them via bun's mock.module BEFORE
 * importing the controller.
 */
import { test, expect, mock, beforeEach } from 'bun:test';

// ── Stub singletons before importing the controller ────────────────────────────
const prismaMock = {
  survey: { findUnique: mock(async () => null) },
  surveyResponse: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: 'resp-1', createdAt: new Date('2026-01-01T00:00:00.000Z') })),
    count: mock(async () => 0),
  },
  appUser: { update: mock(async () => ({})) },
  $transaction: mock(async (fn) => fn(prismaMock)),
};

mock.module('../lib/prisma.mjs', () => ({ default: prismaMock }));
mock.module('../lib/rewardConfig.mjs', () => ({
  getRewardConfig: async () => ({
    surveyCompletionPoints: 10,
    pointsToCashNumerator: 2000,
    pointsToCashDenominator: 50,
  }),
  pointsToUgx: (p, c) => Math.floor((p * c.pointsToCashNumerator) / c.pointsToCashDenominator),
}));
// Fire-and-forget side effects — must return promises (handler calls .catch on them).
mock.module('../lib/eventBus.mjs', () => ({ publishEvent: async () => {} }));
mock.module('../lib/webhookDispatcher.mjs', () => ({ dispatchWebhooks: async () => {} }));
mock.module('./paymentController.mjs', () => ({ processMtnPayment: async () => {}, processAirtelPayment: async () => {} }));
mock.module('../controllers/paymentController.mjs', () => ({ processMtnPayment: async () => {}, processAirtelPayment: async () => {} }));
mock.module('./notificationController.mjs', () => ({ createNotificationFromTemplateHelper: async () => {} }));
mock.module('../controllers/notificationController.mjs', () => ({ createNotificationFromTemplateHelper: async () => {} }));
mock.module('../lib/achievementChecker.mjs', () => ({ checkAndUnlockAchievements: async () => {} }));

const { submitSurveyResponse } = await import('../controllers/surveyController.mjs');

// ── Express req/res fakes (pattern from test/playIntegrity.test.js) ─────────────
function makeRes() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}
function makeReq({ surveyId = 's1', body = {}, userId = 'u1' } = {}) {
  return { params: { surveyId }, body, user: userId ? { id: userId } : undefined };
}
// express-async-handler forwards rejections to next; surface them as test failures.
const next = (err) => {
  if (err) throw err;
};

const HOUR = 60 * 60 * 1000;
function activeSurvey(overrides = {}) {
  return {
    id: 's1',
    title: 'Customer satisfaction',
    userId: 'owner',
    startDate: new Date(Date.now() - HOUR),
    endDate: new Date(Date.now() + HOUR),
    uploads: [],
    ...overrides,
  };
}

beforeEach(() => {
  for (const m of [
    prismaMock.survey.findUnique,
    prismaMock.surveyResponse.findFirst,
    prismaMock.surveyResponse.create,
    prismaMock.surveyResponse.count,
    prismaMock.appUser.update,
    prismaMock.$transaction,
  ]) {
    m.mockClear();
  }
  // Re-assert default happy-path implementations (mockClear keeps impl, but be explicit).
  prismaMock.surveyResponse.findFirst.mockResolvedValue(null);
  prismaMock.surveyResponse.create.mockResolvedValue({
    id: 'resp-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  prismaMock.surveyResponse.count.mockResolvedValue(0);
  prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
});

// ── Request guards ──────────────────────────────────────────────────────────────
test('401 when the request is unauthenticated', async () => {
  const res = makeRes();
  await submitSurveyResponse(makeReq({ userId: null, body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(401);
  expect(res.body.submitted).toBe(false);
});

test('400 when the responses body is empty', async () => {
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: {} } }), res, next);
  expect(res.statusCode).toBe(400);
});

test('accepts the legacy "answers" key as well as "responses"', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey());
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { answers: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(201);
});

test('404 when the survey does not exist', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(null);
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(404);
});

test('400 when the survey has not started yet', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey({ startDate: new Date(Date.now() + HOUR) }));
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(400);
  expect(res.body.message).toMatch(/not started/i);
});

test('410 when the survey has ended', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey({ endDate: new Date(Date.now() - HOUR) }));
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(410);
});

// ── Single-attempt idempotency ───────────────────────────────────────────────────
test('409 when the user has already submitted (pre-check)', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey());
  prismaMock.surveyResponse.findFirst.mockResolvedValueOnce({ id: 'old', createdAt: new Date('2026-05-01') });
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(409);
  expect(res.body.alreadyAttempted).toBe(true);
  expect(prismaMock.surveyResponse.create).not.toHaveBeenCalled();
});

test('409 on the unique-constraint race (P2002)', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey());
  prismaMock.$transaction.mockImplementationOnce(async () => {
    const err = new Error('Unique constraint failed');
    err.code = 'P2002';
    throw err;
  });
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(409);
  expect(res.body.alreadyAttempted).toBe(true);
});

// ── Required + conditional-logic validation ─────────────────────────────────────
test('400 with missingQuestionIds when a required visible question is unanswered', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(
    activeSurvey({
      uploads: [
        { id: 'q1', required: true, conditionalLogic: null },
        { id: 'q2', required: true, conditionalLogic: null },
      ],
    })
  );
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(400);
  expect(res.body.missingQuestionIds).toEqual(['q2']);
});

test('a required question hidden by conditional logic does NOT block submission', async () => {
  // q2 is required but only shown when q1 === "Yes"; answering "No" hides it.
  prismaMock.survey.findUnique.mockResolvedValueOnce(
    activeSurvey({
      uploads: [
        { id: 'q1', required: true, conditionalLogic: null },
        {
          id: 'q2',
          required: true,
          conditionalLogic: {
            logicType: 'all',
            rules: [{ sourceQuestionId: 'q1', operator: 'equals', value: 'Yes' }],
          },
        },
      ],
    })
  );
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'No' } } }), res, next);
  expect(res.statusCode).toBe(201);
});

test('conditional rule matches on the submitted option TEXT', async () => {
  // q2 required, shown when q1 === "Yes". Answering "Yes" reveals it → must be answered.
  prismaMock.survey.findUnique.mockResolvedValueOnce(
    activeSurvey({
      uploads: [
        { id: 'q1', required: true, conditionalLogic: null },
        {
          id: 'q2',
          required: true,
          conditionalLogic: {
            logicType: 'all',
            rules: [{ sourceQuestionId: 'q1', operator: 'equals', value: 'Yes' }],
          },
        },
      ],
    })
  );
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);
  expect(res.statusCode).toBe(400);
  expect(res.body.missingQuestionIds).toEqual(['q2']); // revealed by the text match
});

// ── Success contract + answer persistence ───────────────────────────────────────
test('201 success returns the reward fields and persists answers verbatim', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(
    activeSurvey({ uploads: [{ id: 'q1', required: true, conditionalLogic: null }] })
  );
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes', q2: ['Red', 'Blue'] } } }), res, next);

  expect(res.statusCode).toBe(201);
  expect(res.body).toMatchObject({
    success: true,
    submitted: true,
    pointsAwarded: 10,
    cashEquivalent: 400, // floor(10 * 2000 / 50)
    responseId: 'resp-1',
  });

  // Answers are stored verbatim — no option-membership validation, arrays preserved.
  // This is why the client must submit option TEXT (matches rule values + analytics).
  const created = prismaMock.surveyResponse.create.mock.calls[0][0];
  expect(JSON.parse(created.data.responses)).toEqual({ q1: 'Yes', q2: ['Red', 'Blue'] });
  expect(created.data.userId).toBe('u1');
  expect(created.data.surveyId).toBe('s1');
});

test('credits the fixed reward points to the submitter', async () => {
  prismaMock.survey.findUnique.mockResolvedValueOnce(activeSurvey());
  const res = makeRes();
  await submitSurveyResponse(makeReq({ body: { responses: { q1: 'Yes' } } }), res, next);

  expect(res.statusCode).toBe(201);
  expect(prismaMock.appUser.update).toHaveBeenCalledTimes(1);
  const update = prismaMock.appUser.update.mock.calls[0][0];
  expect(update.where).toEqual({ id: 'u1' });
  expect(update.data).toEqual({ points: { increment: 10 } });
});
