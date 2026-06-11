/**
 * Phase 1 creation-path regression tests for createSurvey + uploadSurvey.
 *
 * Locks:
 *  - uploadSurvey (the path the app actually uses) now validates what
 *    createSurvey half-did and more: title/questions presence, question text,
 *    dates, canonical question types, conditional-logic references. It used to
 *    validate NOTHING (invalid dates → 500s, unknown types → bricked attempts:
 *    the renderer default-cases unknown types to text but isAnswerValid()
 *    returns false, permanently disabling Next on required questions).
 *  - Legacy type aliases normalize onto the renderer vocabulary
 *    (multiple_choice→radio, textarea→paragraph, nps/slider→rating).
 *  - THE conditional-logic remap: builder rules reference client-side ids; the
 *    server rewrites rule.sourceQuestionId onto the DB-minted UUIDs inside the
 *    creation transaction. Before this existed, every app-created rule
 *    referenced ids that didn't exist — conditional logic was dead end-to-end.
 *  - Creation is atomic (survey + questions in one transaction).
 */
import { test, expect, mock, beforeEach } from 'bun:test';

let uuidCounter = 0;
const prismaMock = {
  survey: {
    create: mock(async (args) => ({ id: 'survey-uuid-1', ...args.data })),
  },
  uploadSurvey: {
    create: mock(async (args) => ({ id: `uuid-${++uuidCounter}`, ...args.data })),
    update: mock(async (args) => ({ id: args.where.id, ...args.data })),
  },
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
  pointsToUgx: () => 400,
}));

const { uploadSurvey, createSurvey } = await import('../controllers/surveyController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const DAY = 24 * 60 * 60 * 1000;
function validBody(overrides = {}) {
  return {
    title: 'Customer pulse',
    description: 'How are we doing?',
    startDate: new Date(Date.now()).toISOString(),
    endDate: new Date(Date.now() + DAY).toISOString(),
    questions: [
      { clientId: 'q_1', text: 'Happy?', type: 'radio', options: ['Yes', 'No'], required: true },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  uuidCounter = 0;
  prismaMock.survey.create = mock(async (args) => ({ id: 'survey-uuid-1', ...args.data }));
  prismaMock.uploadSurvey.create = mock(async (args) => ({ id: `uuid-${++uuidCounter}`, ...args.data }));
  prismaMock.uploadSurvey.update = mock(async (args) => ({ id: args.where.id, ...args.data }));
  prismaMock.$transaction = mock(async (fn) => fn(prismaMock));
});

// ---------------------------------------------------------------------------
// uploadSurvey validation (it previously had NONE)
// ---------------------------------------------------------------------------

test.each([
  ['missing title', { title: '   ' }],
  ['empty questions', { questions: [] }],
  ['invalid dates', { startDate: 'not-a-date' }],
  ['end before start', { endDate: new Date(Date.now() - DAY).toISOString() }],
  ['question missing text', { questions: [{ clientId: 'q_1', text: '', type: 'radio', options: [] }] }],
  ['unknown question type', { questions: [{ clientId: 'q_1', text: 'Hm?', type: 'hologram', options: [] }] }],
])('uploadSurvey 400 on %s (no survey created)', async (_label, overrides) => {
  const res = makeRes();
  await uploadSurvey({ body: validBody(overrides), user: { id: 'creator' } }, res, () => {});
  expect(res.statusCode).toBe(400);
  expect(prismaMock.survey.create.mock.calls.length).toBe(0);
});

test('uploadSurvey 400 on a conditional rule referencing a LATER question', async () => {
  const res = makeRes();
  await uploadSurvey(
    {
      body: validBody({
        questions: [
          {
            clientId: 'q_1', text: 'First', type: 'radio', options: ['A'],
            conditionalLogic: { logicType: 'all', rules: [{ sourceQuestionId: 'q_2', operator: 'equals', value: 'A' }] },
          },
          { clientId: 'q_2', text: 'Second', type: 'text', options: [] },
        ],
      }),
      user: { id: 'creator' },
    },
    res, () => {},
  );
  expect(res.statusCode).toBe(400);
  expect(res.body.message).toBe('Invalid conditional logic');
});

test('uploadSurvey 400 on a rule referencing a nonexistent question id', async () => {
  const res = makeRes();
  await uploadSurvey(
    {
      body: validBody({
        questions: [
          { clientId: 'q_1', text: 'First', type: 'radio', options: ['A'] },
          {
            clientId: 'q_2', text: 'Second', type: 'text', options: [],
            conditionalLogic: { logicType: 'all', rules: [{ sourceQuestionId: 'q_GONE', operator: 'equals', value: 'A' }] },
          },
        ],
      }),
      user: { id: 'creator' },
    },
    res, () => {},
  );
  expect(res.statusCode).toBe(400);
});

// ---------------------------------------------------------------------------
// Alias normalization
// ---------------------------------------------------------------------------

test('legacy aliases normalize to the renderer vocabulary (textarea → paragraph)', async () => {
  const res = makeRes();
  await uploadSurvey(
    { body: validBody({ questions: [{ clientId: 'q_1', text: 'Tell us', type: 'textarea', options: [] }] }), user: { id: 'creator' } },
    res, () => {},
  );
  expect(res.statusCode).toBe(201);
  expect(prismaMock.uploadSurvey.create.mock.calls[0][0].data.type).toBe('paragraph');
});

test('createSurvey accepts the app vocabulary it used to reject (radio) and normalizes nps → rating', async () => {
  const res = makeRes();
  await createSurvey(
    {
      body: {
        surveyTitle: 'Legacy payload',
        surveyDescription: 'desc',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + DAY).toISOString(),
        questions: [
          { question: 'Pick', type: 'radio', options: ['A'] },
          { question: 'Score us', type: 'nps', options: [] },
        ],
      },
      user: { id: 'creator' },
    },
    res, () => {},
  );
  expect(res.statusCode).toBe(201);
  const types = prismaMock.uploadSurvey.create.mock.calls.map((c) => c[0].data.type);
  expect(types).toEqual(['radio', 'rating']);
});

// ---------------------------------------------------------------------------
// THE remap — conditional logic finally references real DB ids
// ---------------------------------------------------------------------------

test('conditional-logic rule ids are remapped from builder clientIds to created UUIDs', async () => {
  const res = makeRes();
  await uploadSurvey(
    {
      body: validBody({
        questions: [
          { clientId: 'q_17_1', text: 'Do you drive?', type: 'radio', options: ['Yes', 'No'] },
          {
            clientId: 'q_17_2', text: 'Which car?', type: 'text', options: [],
            conditionalLogic: { logicType: 'all', rules: [{ sourceQuestionId: 'q_17_1', operator: 'equals', value: 'Yes' }] },
          },
        ],
      }),
      user: { id: 'creator' },
    },
    res, () => {},
  );

  expect(res.statusCode).toBe(201);
  // Questions are created sourceless-of-logic first…
  expect(prismaMock.uploadSurvey.create.mock.calls.every((c) => c[0].data.conditionalLogic === null)).toBe(true);
  // …then the rule is written with the REAL created id of question 1 (uuid-1)
  const updateArgs = prismaMock.uploadSurvey.update.mock.calls[0][0];
  expect(updateArgs.where.id).toBe('uuid-2');
  expect(updateArgs.data.conditionalLogic.rules[0].sourceQuestionId).toBe('uuid-1');
});

test('creation is atomic — a mid-transaction failure returns 500 with no partial survey reported', async () => {
  prismaMock.uploadSurvey.create = mock(async () => { throw new Error('disk full'); });

  const res = makeRes();
  await uploadSurvey({ body: validBody(), user: { id: 'creator' } }, res, () => {});

  expect(res.statusCode).toBe(500);
});
