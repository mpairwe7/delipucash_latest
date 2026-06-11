/**
 * AI survey generation — turn a natural-language prompt into draft questions.
 *
 * Provider-neutral: calls OpenAI-compatible Chat Completions over plain `fetch`
 * (no vendor SDK). Primary is NVIDIA NIM (open models, e.g. Llama 3.3 70B
 * Instruct); fallback is Groq (same open model family, very low latency). Both
 * speak the same wire format, so one code path serves both.
 *
 * The model output is NEVER trusted directly: it is parsed as JSON, normalized
 * to the renderer vocabulary (lib/surveyQuestionTypes.mjs), and sanity-checked.
 * On invalid output we do one repair attempt on the same provider, then fall
 * through to the next provider, then fail gracefully. The result is a STARTING
 * point — the creator reviews and edits in the builder before publishing
 * (human-in-the-loop); nothing here auto-publishes.
 *
 * Secret handling: API keys are read from env and sent only in the Authorization
 * header. Keys and full prompts are never logged (we log counts/lengths only).
 */

import { normalizeQuestionType } from './surveyQuestionTypes.mjs';

export class AiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiUnavailableError';
    this.code = 'AI_UNAVAILABLE';
  }
}

export class AiGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiGenerationError';
    this.code = 'AI_GENERATION_FAILED';
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
// Hard ceiling across ALL providers + repair attempts. The worst case
// (2 providers × 2 attempts × per-call timeout) must stay under the Vercel
// function maxDuration (60s in server/vercel.json) so a degraded run returns a
// graceful 502 instead of being platform-killed with a raw 504. Env-tunable.
const DEFAULT_TOTAL_BUDGET_MS = 50_000;
const MIN_CALL_BUDGET_MS = 2_000;
const MAX_QUESTIONS = 25;

/**
 * Resolve the configured providers in priority order. A provider is included
 * only when its API key is present, so a partial config still works (NVIDIA
 * only, Groq only, or both). Model ids are overridable via env; the defaults
 * are open models the providers host free — verify against each provider's
 * current catalog when rotating.
 *
 * NVIDIA default: `moonshotai/kimi-k2.6` (Moonshot AI Kimi K2.6 on NVIDIA NIM,
 * free with NVIDIA Developer registration; OpenAI-compatible). Groq default:
 * Llama 3.3 70B. Both honour chat/completions with JSON mode; the parser also
 * tolerates non-strict JSON, so a provider that ignores response_format still
 * works.
 */
export function resolveProviders(env = process.env) {
  const providers = [];
  if (env.NVIDIA_API_KEY) {
    providers.push({
      name: 'nvidia',
      url: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
      apiKey: env.NVIDIA_API_KEY,
      model: env.NVIDIA_MODEL || 'moonshotai/kimi-k2.6',
    });
  }
  if (env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      url: env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    });
  }
  return providers;
}

const SYSTEM_PROMPT = [
  'You are a survey-design assistant. Given a topic, you produce a concise, high-quality survey.',
  'Respond with a SINGLE JSON object and nothing else — no markdown, no commentary.',
  'Shape:',
  '{',
  '  "title": string,            // short survey title',
  '  "description": string,      // one sentence',
  '  "questions": [ {',
  '    "text": string,           // the question, required, non-empty',
  '    "type": string,           // one of: text, paragraph, radio, checkbox, dropdown, rating, boolean, number, date, time',
  '    "options"?: string[],     // REQUIRED for radio/checkbox/dropdown: 2-6 short, distinct options',
  '    "required"?: boolean,',
  '    "minValue"?: number,      // for rating/number only; min < max',
  '    "maxValue"?: number       // for rating/number only',
  '  } ]',
  '}',
  'Rules: use radio/checkbox/dropdown only WITH at least two distinct options. Use "rating" for 1-5 or 0-10 scales (set minValue/maxValue). Do NOT include conditional logic, scoring, ids, or any other fields. Keep questions clear and unbiased.',
].join('\n');

function buildMessages({ prompt, count, existingQuestions }) {
  const target = count && Number.isInteger(count) ? count : 8;
  const lines = [
    `Create a survey about: ${prompt}`,
    `Aim for about ${target} questions with a sensible mix of question types.`,
  ];
  if (Array.isArray(existingQuestions) && existingQuestions.length > 0) {
    const existingText = existingQuestions
      .map((q) => (typeof q === 'string' ? q : q?.text))
      .filter(Boolean)
      .slice(0, 20)
      .join('; ');
    if (existingText) {
      lines.push(`The survey already has these questions — do NOT repeat them, add complementary ones: ${existingText}`);
    }
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

/** One OpenAI-compatible chat-completion call. Returns the assistant text. */
async function callProvider(provider, messages, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.4,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // Read a short error body for diagnostics — never the request/keys.
      let detail = '';
      try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
      throw new Error(`${provider.name} HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error(`${provider.name} returned no message content`);
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse + normalize model output into usable draft questions. Throws on
 * unrecoverable output (not JSON, or no usable question survives). Returns
 * { title, description, questions }.
 */
export function parseAndNormalize(rawContent) {
  let parsed;
  try {
    parsed = JSON.parse(extractJson(rawContent));
  } catch {
    throw new AiGenerationError('Model did not return valid JSON');
  }

  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const questions = [];
  for (const q of rawQuestions) {
    if (questions.length >= MAX_QUESTIONS) break;
    const text = typeof q?.text === 'string' ? q.text.trim() : '';
    if (!text) continue; // unusable — skip

    const type = normalizeQuestionType(q?.type) || 'text';
    const options = Array.isArray(q?.options)
      ? q.options.map((o) => String(o).trim()).filter(Boolean)
      : [];

    // Choice types need ≥2 real options; if the model under-delivered, fall
    // back to short text so the question content still survives for editing.
    const isChoice = type === 'radio' || type === 'checkbox' || type === 'dropdown';
    const finalType = isChoice && options.length < 2 ? 'text' : type;

    const out = {
      text,
      type: finalType,
      options: finalType === 'radio' || finalType === 'checkbox' || finalType === 'dropdown' ? options : [],
      required: q?.required === true,
    };

    if (finalType === 'rating' || finalType === 'number') {
      const min = Number(q?.minValue);
      const max = Number(q?.maxValue);
      // Only keep bounds when both are finite and non-inverted.
      if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
        out.minValue = min;
        out.maxValue = max;
      } else if (finalType === 'rating') {
        out.minValue = 1;
        out.maxValue = 5;
      }
    }
    questions.push(out);
  }

  if (questions.length === 0) {
    throw new AiGenerationError('Model returned no usable questions');
  }

  return {
    title: typeof parsed?.title === 'string' ? parsed.title.trim().slice(0, 200) : '',
    description: typeof parsed?.description === 'string' ? parsed.description.trim().slice(0, 500) : '',
    questions,
  };
}

/** Pull the first {...} block out of a response in case the model wrapped it. */
function extractJson(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

/**
 * Generate survey questions from a natural-language prompt.
 *
 * @param {{ prompt: string, count?: number, existingQuestions?: any[] }} input
 * @param {{ fetchImpl?: Function, providers?: any[], timeoutMs?: number, totalBudgetMs?: number, now?: Function, env?: object }} [opts]
 * @returns {Promise<{ title: string, description: string, questions: object[], provider: string }>}
 */
export async function generateSurveyQuestions(input, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const env = opts.env || process.env;
  const perCallTimeout = opts.timeoutMs || Number(env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const totalBudget = opts.totalBudgetMs || Number(env.AI_TOTAL_BUDGET_MS) || DEFAULT_TOTAL_BUDGET_MS;
  const now = opts.now || Date.now;
  const providers = opts.providers || resolveProviders(env);

  if (!fetchImpl) throw new AiUnavailableError('No fetch implementation available');
  if (providers.length === 0) {
    throw new AiUnavailableError('AI survey generation is not configured (no provider API key set)');
  }

  const messages = buildMessages(input);
  const deadline = now() + totalBudget;
  let lastError;
  let budgetExhausted = false;

  for (const provider of providers) {
    if (budgetExhausted) break;
    // Up to two attempts per provider: initial, then one repair re-prompt.
    let attemptMessages = messages;
    for (let attempt = 0; attempt < 2; attempt++) {
      // Each call's timeout is the smaller of the per-call limit and the time
      // left in the overall budget, so the total never exceeds totalBudget.
      const remaining = deadline - now();
      if (remaining < MIN_CALL_BUDGET_MS) {
        budgetExhausted = true;
        lastError = lastError || new Error('time budget exhausted');
        break;
      }
      try {
        const content = await callProvider(provider, attemptMessages, {
          fetchImpl,
          timeoutMs: Math.min(perCallTimeout, remaining),
        });
        const result = parseAndNormalize(content);
        return { ...result, provider: provider.name };
      } catch (err) {
        lastError = err;
        // Network/HTTP/timeout errors won't be fixed by a repair prompt — move
        // to the next provider immediately. Only retry on bad MODEL OUTPUT.
        const isOutputError = err instanceof AiGenerationError;
        console.warn(`[aiSurveyGenerator] ${provider.name} attempt ${attempt + 1} failed: ${err.message}`);
        if (!isOutputError) break;
        if (attempt === 0) {
          attemptMessages = [
            ...messages,
            { role: 'assistant', content: '(invalid output)' },
            { role: 'user', content: `Your previous response was invalid (${err.message}). Respond again with ONLY the JSON object described, correctly formatted.` },
          ];
        }
      }
    }
  }

  throw new AiGenerationError(`All providers failed${lastError ? `: ${lastError.message}` : ''}`);
}
