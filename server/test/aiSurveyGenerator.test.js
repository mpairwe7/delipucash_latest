/**
 * Tests for AI survey generation (lib/aiSurveyGenerator.mjs) — creation PR 4.
 *
 * The LLM call is mocked via an injected fetch; no network and no API keys are
 * used. Covers: provider resolution from env, output parse/normalize to the
 * renderer vocabulary, the repair retry on bad output, NVIDIA→Groq fallback on
 * a provider error, and the "not configured" path.
 */
import { test, expect } from 'bun:test';
import {
  resolveProviders,
  parseAndNormalize,
  generateSurveyQuestions,
  AiUnavailableError,
  AiGenerationError,
} from '../lib/aiSurveyGenerator.mjs';

const NVIDIA = { name: 'nvidia', url: 'https://nim/x', apiKey: 'k1', model: 'meta/llama-3.3-70b-instruct' };
const GROQ = { name: 'groq', url: 'https://groq/x', apiKey: 'k2', model: 'llama-3.3-70b-versatile' };

function completion(content) {
  return {
    ok: true,
    status: 200,
    async json() { return { choices: [{ message: { content } }] }; },
    async text() { return content; },
  };
}
function httpError(status) {
  return { ok: false, status, async text() { return 'upstream error'; }, async json() { return {}; } };
}
const goodPayload = JSON.stringify({
  title: 'Coffee Shop CSAT',
  description: 'How was your visit?',
  questions: [
    { text: 'How satisfied were you?', type: 'rating', minValue: 1, maxValue: 5, required: true },
    { text: 'Which drink did you order?', type: 'multiple_choice', options: ['Espresso', 'Latte', 'Tea'] },
    { text: 'Any comments?', type: 'textarea' },
  ],
});

// ---------------------------------------------------------------------------
// resolveProviders
// ---------------------------------------------------------------------------

test('resolveProviders includes only providers with a key, NVIDIA first', () => {
  expect(resolveProviders({}).length).toBe(0);
  expect(resolveProviders({ GROQ_API_KEY: 'g' }).map((p) => p.name)).toEqual(['groq']);
  const both = resolveProviders({ NVIDIA_API_KEY: 'n', GROQ_API_KEY: 'g' });
  expect(both.map((p) => p.name)).toEqual(['nvidia', 'groq']);
});

test('NVIDIA defaults to the free Kimi K2.6 model, Groq to Llama 3.3', () => {
  const [nvidia] = resolveProviders({ NVIDIA_API_KEY: 'n' });
  expect(nvidia.model).toBe('moonshotai/kimi-k2.6');
  expect(nvidia.url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
  const [groq] = resolveProviders({ GROQ_API_KEY: 'g' });
  expect(groq.model).toBe('llama-3.3-70b-versatile');
});

test('resolveProviders honours model/url overrides', () => {
  const [p] = resolveProviders({ NVIDIA_API_KEY: 'n', NVIDIA_MODEL: 'custom/model' });
  expect(p.model).toBe('custom/model');
});

test('mirrors the current .env.local — Groq-only config resolves to one provider', () => {
  // .env.local has GROQ_API_KEY + GROQ_MODEL=llama-3.3-70b-versatile and no NVIDIA key.
  const providers = resolveProviders({ GROQ_API_KEY: 'gsk_x', GROQ_MODEL: 'llama-3.3-70b-versatile' });
  expect(providers).toHaveLength(1);
  expect(providers[0]).toMatchObject({ name: 'groq', model: 'llama-3.3-70b-versatile' });
});

// ---------------------------------------------------------------------------
// parseAndNormalize
// ---------------------------------------------------------------------------

test('parseAndNormalize maps to the renderer vocabulary and keeps valid bounds', () => {
  const result = parseAndNormalize(goodPayload);
  expect(result.title).toBe('Coffee Shop CSAT');
  expect(result.questions.map((q) => q.type)).toEqual(['rating', 'radio', 'paragraph']);
  expect(result.questions[0]).toMatchObject({ minValue: 1, maxValue: 5 });
  expect(result.questions[1].options).toEqual(['Espresso', 'Latte', 'Tea']);
});

test('parseAndNormalize downgrades a choice type with <2 options to text', () => {
  const result = parseAndNormalize(JSON.stringify({ questions: [{ text: 'Pick', type: 'radio', options: ['only one'] }] }));
  expect(result.questions[0].type).toBe('text');
});

test('parseAndNormalize drops inverted rating bounds (falls back to 1..5)', () => {
  const result = parseAndNormalize(JSON.stringify({ questions: [{ text: 'Rate', type: 'rating', minValue: 9, maxValue: 2 }] }));
  expect(result.questions[0]).toMatchObject({ minValue: 1, maxValue: 5 });
});

test('parseAndNormalize tolerates the model wrapping JSON in prose', () => {
  const wrapped = 'Here is your survey:\n' + goodPayload + '\nHope that helps!';
  expect(parseAndNormalize(wrapped).questions.length).toBe(3);
});

test('parseAndNormalize throws on non-JSON and on zero usable questions', () => {
  expect(() => parseAndNormalize('not json at all')).toThrow(AiGenerationError);
  expect(() => parseAndNormalize(JSON.stringify({ questions: [{ text: '   ' }] }))).toThrow(AiGenerationError);
});

// ---------------------------------------------------------------------------
// generateSurveyQuestions — orchestration
// ---------------------------------------------------------------------------

test('generateSurveyQuestions returns normalized questions from the primary provider', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); return completion(goodPayload); };
  const result = await generateSurveyQuestions({ prompt: 'coffee shop' }, { fetchImpl, providers: [NVIDIA, GROQ] });
  expect(result.provider).toBe('nvidia');
  expect(result.questions.length).toBe(3);
  expect(calls).toHaveLength(1); // primary succeeded; Groq not called
});

test('repairs bad output with one retry on the SAME provider before falling through', async () => {
  let n = 0;
  const fetchImpl = async () => { n += 1; return completion(n === 1 ? 'garbage not json' : goodPayload); };
  const result = await generateSurveyQuestions({ prompt: 'x' }, { fetchImpl, providers: [NVIDIA, GROQ] });
  expect(result.provider).toBe('nvidia');
  expect(n).toBe(2); // initial + repair, no fallback
});

test('stops within the total time budget instead of exhausting every provider+retry', async () => {
  // Each call "takes" 4s of budget (injected clock); with a 5s budget only ONE
  // call fits — the generator must give up gracefully, not run all 4 attempts.
  // Guards the worst-case latency staying under the Vercel function maxDuration.
  let t = 0;
  const now = () => t;
  let calls = 0;
  const fetchImpl = async () => { calls += 1; t += 4000; return completion('garbage not json'); };
  await expect(
    generateSurveyQuestions({ prompt: 'x' }, { fetchImpl, providers: [NVIDIA, GROQ], totalBudgetMs: 5000, now }),
  ).rejects.toBeInstanceOf(AiGenerationError);
  expect(calls).toBe(1); // budget exhausted after the first call, not 4
});

test('falls back NVIDIA→Groq on a provider HTTP error (no repair on transport errors)', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url === NVIDIA.url) return httpError(500);
    return completion(goodPayload);
  };
  const result = await generateSurveyQuestions({ prompt: 'x' }, { fetchImpl, providers: [NVIDIA, GROQ] });
  expect(result.provider).toBe('groq');
  // NVIDIA failed once (transport → no repair), then Groq once
  expect(seen).toEqual([NVIDIA.url, GROQ.url]);
});

test('throws AiGenerationError when every provider fails', async () => {
  const fetchImpl = async () => httpError(503);
  await expect(
    generateSurveyQuestions({ prompt: 'x' }, { fetchImpl, providers: [NVIDIA, GROQ] }),
  ).rejects.toBeInstanceOf(AiGenerationError);
});

test('throws AiUnavailableError when no provider is configured', async () => {
  await expect(
    generateSurveyQuestions({ prompt: 'x' }, { fetchImpl: async () => completion(goodPayload), providers: [] }),
  ).rejects.toBeInstanceOf(AiUnavailableError);
});
