/**
 * Deterministic fixtures for the survey-screen regression suite.
 * Mirrors question.factory.ts; reuses makeUser for the embedded AppUser.
 *
 * Shape from types/index.ts `Survey` and services/hooks.ts (useRunningSurveys etc. return
 * `Survey[]`; useSurvey returns `Survey | null`).
 */
import type { Survey } from '@/types';
import { makeUser } from '@/__tests__/fixtures/question.factory';

const FIXED = '2026-06-01T09:00:00.000Z';

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
