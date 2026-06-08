/**
 * Deterministic fixtures for the survey-screen regression suite.
 * Mirrors question.factory.ts; reuses makeUser for the embedded AppUser.
 *
 * Shape from types/index.ts `Survey` and services/hooks.ts (useRunningSurveys etc. return
 * `Survey[]`; useSurvey returns `Survey | null`).
 */
import type { Survey, UploadSurvey, SurveyResponse } from '@/types';
import { makeUser } from '@/__tests__/fixtures/question.factory';

const FIXED = '2026-06-01T09:00:00.000Z';
const FIXED_MS = new Date(FIXED).getTime();

export function makeSurvey(overrides: Partial<Survey> = {}): Survey {
  const id = overrides.id ?? 's-1';
  return {
    id,
    title: 'Customer satisfaction survey',
    description: 'Help us improve by sharing your feedback.',
    userId: 'u-1',
    user: makeUser(),
    startDate: '2026-05-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    createdAt: FIXED,
    updatedAt: FIXED,
    totalResponses: 12,
    maxResponses: 100,
    rewardAmount: 500,
    status: 'running',
    ...overrides,
  } as Survey;
}

/** A list of surveys (what the feed query hooks return). */
export function makeSurveys(count = 3, overrides: Partial<Survey> = {}): Survey[] {
  return Array.from({ length: count }, (_, i) =>
    makeSurvey({ id: `s-${i + 1}`, title: `Survey ${i + 1}`, ...overrides })
  );
}

/** A mock of a TanStack `useQuery` result for a survey list. */
export function makeSurveyQuery(data: Survey[] = makeSurveys(), overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Survey-taking screen (app/survey/[id].tsx) — `useSurvey` returns a Survey whose
// `uploads` are the questions; `useCheckSurveyAttempt` gates single-attempt access.
// ─────────────────────────────────────────────────────────────────────────────

/** A single survey question (the take screen maps `survey.uploads` → its question list). */
export function makeUploadSurvey(overrides: Partial<UploadSurvey> = {}): UploadSurvey {
  const id = overrides.id ?? 'q-1';
  return {
    id,
    text: 'How satisfied are you with the app?',
    type: 'text',
    options: '[]',
    placeholder: null,
    minValue: null,
    maxValue: null,
    required: true,
    userId: 'u-1',
    surveyId: 's-1',
    conditionalLogic: null,
    createdAt: FIXED,
    updatedAt: FIXED,
    ...overrides,
  } as UploadSurvey;
}

/** A Survey with embedded `uploads` — the shape `useSurvey` returns for the take screen. */
export function makeSurveyWithQuestions(
  uploads: UploadSurvey[] = [makeUploadSurvey()],
  overrides: Partial<Survey> = {}
): Survey {
  return makeSurvey({ uploads, ...overrides });
}

/** A mock of the `useSurvey` query result (single survey, with `uploads`). */
export function makeSurveyDetailQuery(
  data: Survey | null = makeSurveyWithQuestions(),
  overrides: Record<string, unknown> = {}
) {
  return { data, isLoading: false, error: null, isFetching: false, refetch: jest.fn(), ...overrides };
}

/** A mock of the `useCheckSurveyAttempt` query result (defaults to "not yet attempted"). */
export function makeAttemptStatus(overrides: Record<string, unknown> = {}) {
  return { data: { hasAttempted: false, attemptedAt: null }, isLoading: false, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner responses screen (app/survey-responses/[id].tsx) — `useSurveyResponseData`
// aggregates the survey, its questions, and the server-side responses.
// ─────────────────────────────────────────────────────────────────────────────

/** A single server-side response. `responses` is a JSON string keyed by question id. */
export function makeSurveyResponse(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  const id = overrides.id ?? 'r-1';
  return {
    id,
    userId: 'u-1',
    surveyId: 's-1',
    responses: JSON.stringify({ 'q-1': 'Great app, very useful.' }),
    user: makeUser(),
    createdAt: FIXED,
    updatedAt: FIXED,
    ...overrides,
  } as SurveyResponse;
}

/** N server-side responses with distinct ids/respondents. */
export function makeSurveyResponses(count = 3, overrides: Partial<SurveyResponse> = {}): SurveyResponse[] {
  return Array.from({ length: count }, (_, i) =>
    makeSurveyResponse({ id: `r-${i + 1}`, userId: `u-${i + 1}`, ...overrides })
  );
}

/**
 * A mock of the `useSurveyResponseData` aggregate hook.
 * Keys match the screen's destructure (app/survey-responses/[id].tsx:175):
 * { survey, questions, responses, isOwner, isLoading, isFetching, isError, error,
 *   refetchAll, dataUpdatedAt }.
 */
export function makeResponseData(overrides: Record<string, unknown> = {}) {
  return {
    survey: makeSurvey(),
    questions: [makeUploadSurvey()],
    responses: [makeSurveyResponse()],
    isOwner: true,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetchAll: jest.fn(),
    dataUpdatedAt: FIXED_MS,
    ...overrides,
  };
}
