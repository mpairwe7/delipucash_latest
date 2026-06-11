/**
 * Tests for the AI generate endpoint controller (creation PR 4).
 * The generator is mocked; this locks request validation and error mapping.
 */
import { test, expect, mock, beforeEach } from 'bun:test';
import { AiUnavailableError, AiGenerationError } from '../lib/aiSurveyGenerator.mjs';

let genImpl;
mock.module('../lib/aiSurveyGenerator.mjs', () => ({
  generateSurveyQuestions: (...args) => genImpl(...args),
  AiUnavailableError,
  AiGenerationError,
}));

const { generateAiSurvey } = await import('../controllers/surveyAiController.mjs');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const run = (body) => {
  const res = makeRes();
  return generateAiSurvey({ body, user: { id: 'u1' } }, res, (e) => { if (e) throw e; }).then(() => res);
};

beforeEach(() => {
  genImpl = mock(async () => ({
    title: 'T', description: 'D',
    questions: [{ text: 'Q', type: 'text', options: [], required: false }],
    provider: 'nvidia',
  }));
});

test('400 when prompt is missing or blank', async () => {
  expect((await run({})).statusCode).toBe(400);
  expect((await run({ prompt: '   ' })).statusCode).toBe(400);
});

test('400 when prompt exceeds the length cap', async () => {
  const res = await run({ prompt: 'x'.repeat(1001) });
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('PROMPT_TOO_LONG');
});

test('400 on an out-of-range question count', async () => {
  expect((await run({ prompt: 'hi', count: 0 })).statusCode).toBe(400);
  expect((await run({ prompt: 'hi', count: 99 })).statusCode).toBe(400);
  expect((await run({ prompt: 'hi', count: 2.5 })).statusCode).toBe(400);
});

test('200 returns the generated draft (title/description/questions, no provider leak)', async () => {
  const res = await run({ prompt: 'coffee shop satisfaction', count: 6 });
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ success: true, title: 'T', description: 'D' });
  expect(res.body.questions).toHaveLength(1);
  expect(res.body.provider).toBeUndefined();
});

test('503 when the generator reports it is not configured', async () => {
  genImpl = mock(async () => { throw new AiUnavailableError('no key'); });
  const res = await run({ prompt: 'hi' });
  expect(res.statusCode).toBe(503);
  expect(res.body.code).toBe('AI_UNAVAILABLE');
});

test('502 when generation fails', async () => {
  genImpl = mock(async () => { throw new AiGenerationError('all providers failed'); });
  const res = await run({ prompt: 'hi' });
  expect(res.statusCode).toBe(502);
  expect(res.body.code).toBe('AI_GENERATION_FAILED');
});
