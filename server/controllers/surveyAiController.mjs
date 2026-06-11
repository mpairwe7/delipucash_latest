/**
 * AI survey generation endpoint.
 *
 * POST /api/surveys/ai/generate — turn a natural-language prompt into draft
 * questions (NVIDIA NIM primary, Groq fallback; see lib/aiSurveyGenerator.mjs).
 * Auth + paywall + rate limiting are applied by the route. The response is a
 * draft the creator reviews/edits in the builder before publishing — this never
 * creates a survey.
 */

import asyncHandler from 'express-async-handler';
import {
  generateSurveyQuestions,
  AiUnavailableError,
  AiGenerationError,
} from '../lib/aiSurveyGenerator.mjs';

const MAX_PROMPT_LENGTH = 1000;

export const generateAiSurvey = asyncHandler(async (req, res) => {
  const { prompt, count, existingQuestions } = req.body || {};

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, code: 'PROMPT_REQUIRED', message: 'Describe the survey you want to create.' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ success: false, code: 'PROMPT_TOO_LONG', message: `Keep the description under ${MAX_PROMPT_LENGTH} characters.` });
  }

  let parsedCount;
  if (count !== undefined) {
    parsedCount = Number(count);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 25) {
      return res.status(400).json({ success: false, code: 'INVALID_COUNT', message: 'Question count must be between 1 and 25.' });
    }
  }

  // Log counts only — never the prompt text (may contain PII).
  console.log(`[surveyAi] generate request: userId=${req.user?.id}, promptLen=${prompt.length}, count=${parsedCount ?? 'default'}`);

  try {
    const result = await generateSurveyQuestions({
      prompt: prompt.trim(),
      count: parsedCount,
      existingQuestions: Array.isArray(existingQuestions) ? existingQuestions : undefined,
    });
    return res.status(200).json({
      success: true,
      title: result.title,
      description: result.description,
      questions: result.questions,
    });
  } catch (err) {
    if (err instanceof AiUnavailableError) {
      return res.status(503).json({ success: false, code: 'AI_UNAVAILABLE', message: 'AI generation is not available right now. You can still build your survey manually.' });
    }
    if (err instanceof AiGenerationError) {
      return res.status(502).json({ success: false, code: 'AI_GENERATION_FAILED', message: 'The AI could not generate a survey from that prompt. Try rephrasing, or build manually.' });
    }
    throw err;
  }
});
