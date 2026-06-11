/**
 * Phase 1 security regression tests for surveyController + surveyAccess.
 *
 * Locks the invariants that close the survey tamper/availability holes:
 *  - updateSurvey scopes per-question writes to THE OWNED SURVEY — the previous
 *    unscoped update({ where: { id: q.id } }) let any survey owner tamper with
 *    questions of OTHER surveys (IDOR). Unknown ids → 400 + transaction rollback.
 *  - Structural edits are locked once a survey has responses (answers are keyed
 *    by question id + option text — edits would corrupt them silently).
 *  - Single-sided date updates validate the COMBINED window.
 *  - deleteSurvey refuses (409) when responses exist — they are respondents'
 *    earning records and the FK has no cascade (the old code 500'd on P2003
 *    after already deleting the questions). Zero-response deletes are atomic,
 *    with R2 cleanup AFTER the commit.
 *  - requireSurveyCreatorAccess enforces the paywall server-side (it was
 *    client-only: any authenticated user could create surveys by direct API).
 *
 * Prisma + side-effect modules are stubbed via bun's mock.module BEFORE import.
 * r2.mjs is mocked as a FULL spread (partial mocks drop exports process-wide).
 */
import { test, expect, mock, beforeEach } from 'bun:test';
import * as realR2 from '../lib/r2.mjs';

const prismaMock = {
  survey: {
    findUnique: mock(async () => null),
    update: mock(async (args) => ({ id: 's1', userId: 'owner', ...args.data })),
    updateMany: mock(async () => ({ count: 1 })),
    delete: mock(async () => ({})),
    findMany: mock(async () => []),
  },
  uploadSurvey: {
    update: mock(async () => ({})),
    updateMany: mock(async () => ({ count: 1 })),
    create: mock(async () => ({})),
    deleteMany: mock(async () => ({ count: 0 })),
  },
  surveyResponse: {
    findFirst: mock(async () => null),
    count: mock(async () => 0),
  },
  surveyFileUpload: { findMany: mock(async () => []) },
  appUser: { findUnique: mock(async () => ({ role: 'USER' })), update: mock(async () => ({})) },
  payment: { findFirst: mock(async () => null) },
  notification: { findFirst: mock(async () => null) },
  $transaction: mock(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock))),
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
  pointsToUgx: () => 400,
}));

let deleteFileMock = mock(async () => true);
mock.module('../lib/r2.mjs', () => ({ ...realR2, deleteFile: (...args) => deleteFileMock(...args) }));

const { updateSurvey, deleteSurvey } = await import('../controllers/surveyController.mjs');
const { requireSurveyCreatorAccess } = await import('../utils/surveyAccess.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const HOUR = 60 * 60 * 1000;
const ownedSurvey = {
  userId: 'owner',
  startDate: new Date(Date.now() - HOUR),
  endDate: new Date(Date.now() + HOUR),
};

beforeEach(() => {
  prismaMock.survey.findUnique = mock(async () => ({ ...ownedSurvey }));
  prismaMock.survey.update = mock(async (args) => ({ id: 's1', userId: 'owner', ...args.data }));
  prismaMock.survey.delete = mock(async () => ({}));
  prismaMock.uploadSurvey.updateMany = mock(async () => ({ count: 1 }));
  prismaMock.uploadSurvey.create = mock(async () => ({}));
  prismaMock.uploadSurvey.deleteMany = mock(async () => ({ count: 0 }));
  prismaMock.surveyResponse.count = mock(async () => 0);
  prismaMock.surveyFileUpload.findMany = mock(async () => []);
  prismaMock.appUser.findUnique = mock(async () => ({ role: 'USER' }));
  prismaMock.payment.findFirst = mock(async () => null);
  prismaMock.$transaction = mock(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock)));
  deleteFileMock = mock(async () => true);
});

// ---------------------------------------------------------------------------
// updateSurvey — ownership, IDOR scoping, edit lock, dates, types
// ---------------------------------------------------------------------------

test('updateSurvey rejects a non-owner with 403 and never writes', async () => {
  const res = makeRes();
  await updateSurvey(
    { params: { surveyId: 's1' }, body: { title: 'hacked' }, user: { id: 'intruder' } },
    res, () => {},
  );
  expect(res.statusCode).toBe(403);
  expect(prismaMock.survey.update.mock.calls.length).toBe(0);
});

test('question updates are SCOPED to the owned survey — foreign ids → 400, rolled back', async () => {
  let captured;
  prismaMock.uploadSurvey.updateMany = mock(async (args) => {
    captured = args;
    return { count: 0 }; // the id does not belong to this survey
  });

  const res = makeRes();
  await updateSurvey(
    {
      params: { surveyId: 's1' },
      body: { questions: [{ id: 'someone-elses-question', text: 'pwn', type: 'text', options: [] }] },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(captured.where).toEqual({ id: 'someone-elses-question', surveyId: 's1' });
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('UNKNOWN_QUESTION_IDS');
  expect(res.body.ids).toEqual(['someone-elses-question']);
});

test('structural edits are locked once responses exist (409 EDIT_LOCKED)', async () => {
  prismaMock.surveyResponse.count = mock(async () => 5);

  const res = makeRes();
  await updateSurvey(
    {
      params: { surveyId: 's1' },
      body: { questions: [{ id: 'q1', text: 'changed', type: 'text', options: [] }] },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('EDIT_LOCKED');
  expect(prismaMock.uploadSurvey.updateMany.mock.calls.length).toBe(0);
});

test('metadata-only edits stay allowed when responses exist', async () => {
  prismaMock.surveyResponse.count = mock(async () => 5);

  const res = makeRes();
  await updateSurvey(
    { params: { surveyId: 's1' }, body: { title: 'New title' }, user: { id: 'owner' } },
    res, () => {},
  );

  expect(res.statusCode).toBe(200);
});

test('single-sided endDate update validates against the EXISTING startDate', async () => {
  const res = makeRes();
  await updateSurvey(
    {
      params: { surveyId: 's1' },
      // before the survey's existing startDate (1h ago) → invalid window
      body: { endDate: new Date(Date.now() - 2 * HOUR).toISOString() },
      user: { id: 'owner' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(400);
  expect(prismaMock.survey.update.mock.calls.length).toBe(0);
});

test('question types are validated and legacy aliases normalize (multiple_choice → radio)', async () => {
  let captured;
  prismaMock.uploadSurvey.updateMany = mock(async (args) => { captured = args; return { count: 1 }; });

  const res = makeRes();
  await updateSurvey(
    {
      params: { surveyId: 's1' },
      body: { questions: [{ id: 'q1', text: 'Pick one', type: 'multiple_choice', options: ['A'] }] },
      user: { id: 'owner' },
    },
    res, () => {},
  );
  expect(res.statusCode).toBe(200);
  expect(captured.data.type).toBe('radio');

  const res2 = makeRes();
  await updateSurvey(
    { params: { surveyId: 's1' }, body: { questions: [{ id: 'q1', text: 'x', type: 'hologram' }] }, user: { id: 'owner' } },
    res2, () => {},
  );
  expect(res2.statusCode).toBe(400);
});

// ---------------------------------------------------------------------------
// deleteSurvey — responses guard, atomicity, R2 after commit
// ---------------------------------------------------------------------------

test('deleteSurvey rejects a non-owner with 403', async () => {
  const res = makeRes();
  await deleteSurvey({ params: { surveyId: 's1' }, user: { id: 'intruder' } }, res, () => {});
  expect(res.statusCode).toBe(403);
  expect(prismaMock.survey.delete.mock.calls.length).toBe(0);
});

test('deleteSurvey refuses when responses exist (409, nothing deleted)', async () => {
  prismaMock.surveyResponse.count = mock(async () => 3);

  const res = makeRes();
  await deleteSurvey({ params: { surveyId: 's1' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('SURVEY_HAS_RESPONSES');
  expect(prismaMock.$transaction.mock.calls.length).toBe(0);
  expect(prismaMock.uploadSurvey.deleteMany.mock.calls.length).toBe(0);
  expect(deleteFileMock.mock.calls.length).toBe(0);
});

test('zero-response delete is transactional and cleans R2 AFTER the commit', async () => {
  const order = [];
  prismaMock.surveyFileUpload.findMany = mock(async () => [{ r2Key: 'surveys/f1.pdf' }]);
  prismaMock.$transaction = mock(async (arg) => {
    order.push('transaction');
    return Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock);
  });
  deleteFileMock = mock(async (key) => { order.push(`r2:${key}`); return true; });

  const res = makeRes();
  await deleteSurvey({ params: { surveyId: 's1' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(200);
  expect(order).toEqual(['transaction', 'r2:surveys/f1.pdf']);
});

test('a response landing mid-delete (P2003) returns 409, not 500', async () => {
  prismaMock.$transaction = mock(async () => {
    const e = new Error('fk violation');
    e.code = 'P2003';
    throw e;
  });

  const res = makeRes();
  await deleteSurvey({ params: { surveyId: 's1' }, user: { id: 'owner' } }, res, () => {});

  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('SURVEY_HAS_RESPONSES');
});

// ---------------------------------------------------------------------------
// requireSurveyCreatorAccess — the server-side paywall
// ---------------------------------------------------------------------------

function runGate(user, payment = null) {
  prismaMock.appUser.findUnique = mock(async () => user);
  prismaMock.payment.findFirst = mock(async () => payment);
  const res = makeRes();
  let nextCalled = false;
  return requireSurveyCreatorAccess({ user: { id: 'u1' } }, res, () => { nextCalled = true; })
    .then(() => ({ res, nextCalled }));
}

test('no subscription → 403 SUBSCRIPTION_REQUIRED', async () => {
  const { res, nextCalled } = await runGate({ role: 'USER', surveysubscriptionStatus: 'INACTIVE', subscriptionStatus: 'INACTIVE' });
  expect(nextCalled).toBe(false);
  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
});

test('survey subscription ACTIVE → allowed', async () => {
  const { nextCalled } = await runGate({ role: 'USER', surveysubscriptionStatus: 'ACTIVE', subscriptionStatus: 'INACTIVE' });
  expect(nextCalled).toBe(true);
});

test('legacy subscriptionStatus ACTIVE → allowed', async () => {
  const { nextCalled } = await runGate({ role: 'USER', surveysubscriptionStatus: 'INACTIVE', subscriptionStatus: 'ACTIVE' });
  expect(nextCalled).toBe(true);
});

test('unexpired SUCCESSFUL MoMo SURVEY payment → allowed', async () => {
  const { nextCalled } = await runGate(
    { role: 'USER', surveysubscriptionStatus: 'INACTIVE', subscriptionStatus: 'INACTIVE' },
    { id: 'pay-1' },
  );
  expect(nextCalled).toBe(true);
});

test('ADMIN bypasses the paywall', async () => {
  const { nextCalled } = await runGate({ role: 'ADMIN', surveysubscriptionStatus: 'INACTIVE', subscriptionStatus: 'INACTIVE' });
  expect(nextCalled).toBe(true);
});
