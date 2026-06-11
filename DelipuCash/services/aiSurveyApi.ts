/**
 * AI Survey API — generate draft questions from a natural-language prompt.
 *
 * Calls POST /api/surveys/ai/generate (NVIDIA NIM primary, Groq fallback,
 * server-side). Returns draft questions mapped to the builder's
 * BuilderQuestionData shape so the creator can review and edit before
 * publishing — this never creates a survey.
 */

import { useAuthStore } from '@/utils/auth/store';
import type { BuilderQuestionData, BuilderQuestionType } from '@/store/SurveyBuilderStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';

const getAuthToken = (): string | null => useAuthStore.getState().auth?.token || null;

export interface AiGenerateRequest {
  prompt: string;
  count?: number;
  existingQuestions?: { text: string }[];
}

interface AiGeneratedQuestion {
  text: string;
  type: string;
  options?: string[];
  required?: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface AiGenerateResult {
  success: boolean;
  title?: string;
  description?: string;
  questions?: BuilderQuestionData[];
  /** Error message for display when success is false. */
  error?: string;
  /** Stable error code for branching (AI_UNAVAILABLE, AI_GENERATION_FAILED, …). */
  code?: string;
}

let aiQuestionCounter = 0;
function toBuilderQuestion(q: AiGeneratedQuestion): BuilderQuestionData {
  aiQuestionCounter += 1;
  return {
    id: `ai_${Date.now()}_${aiQuestionCounter}`,
    text: q.text,
    type: q.type as BuilderQuestionType,
    options: Array.isArray(q.options) ? q.options : [],
    required: q.required ?? false,
    minValue: q.minValue,
    maxValue: q.maxValue,
    conditionalLogic: null,
    fileUploadConfig: null,
    points: 0,
  };
}

export async function generateAiSurvey(req: AiGenerateRequest): Promise<AiGenerateResult> {
  const token = getAuthToken();
  if (!token) return { success: false, error: 'Please sign in to use AI generation.', code: 'NOT_AUTHENTICATED' };

  try {
    const response = await fetch(`${API_BASE_URL}/api/surveys/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || 'AI generation failed. Please try again.',
        code: json?.code,
      };
    }

    return {
      success: true,
      title: typeof json.title === 'string' ? json.title : '',
      description: typeof json.description === 'string' ? json.description : '',
      questions: Array.isArray(json.questions) ? json.questions.map(toBuilderQuestion) : [],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during AI generation.',
      code: 'NETWORK_ERROR',
    };
  }
}
