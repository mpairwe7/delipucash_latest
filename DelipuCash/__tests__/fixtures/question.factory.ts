/**
 * Deterministic fixtures for the question-screen regression suite.
 *
 * Fixed ids/dates keep render output and snapshots stable. Factories satisfy the
 * runtime fields the components actually read; types are asserted via `as` because the
 * full domain types carry many optional fields the UI never touches.
 *
 * Shapes mirror services/questionHooks.ts:
 *  - QuestionsFeedResult  → useInfiniteQuestionsFeed page
 *  - FeedQuestion & { responses } → useQuestionDetail data
 *  - Response             → types/index.ts (transformResponses input)
 */
import type { Response } from '@/types';
import type { FeedQuestion } from '@/components/feed/QuestionFeedItem';
import type { QuestionsFeedResult } from '@/services/questionHooks';

const FIXED_CREATED_AT = '2026-06-01T09:00:00.000Z';

/** A single answer/response (input to transformResponses). */
export function makeResponse(overrides: Partial<Response> = {}): Response {
  const id = overrides.id ?? 'r-1';
  return {
    id,
    responseText: 'Use React Native Testing Library with the jest-expo preset.',
    userId: 'u-1',
    user: {
      id: 'u-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    },
    questionId: 'q-1',
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_CREATED_AT,
    likeCount: 2,
    dislikeCount: 0,
    isLiked: false,
    isDisliked: false,
    ...overrides,
  } as Response;
}

/** A feed question (list item / hero card source). */
export function makeFeedQuestion(overrides: Partial<FeedQuestion> = {}): FeedQuestion {
  const id = overrides.id ?? 'q-1';
  return {
    id,
    text: 'How do I write UI regression tests for a React Native screen?',
    userId: 'u-2',
    createdAt: FIXED_CREATED_AT,
    updatedAt: FIXED_CREATED_AT,
    category: 'Technology',
    rewardAmount: 0,
    isInstantReward: false,
    totalAnswers: 2,
    viewCount: 10,
    author: { id: 'u-2', firstName: 'Grace', lastName: 'Hopper', name: 'Grace Hopper' },
    upvotes: 3,
    downvotes: 0,
    hasAcceptedAnswer: false,
    hasExpertAnswer: false,
    isHot: false,
    isTrending: false,
    followersCount: 0,
    userHasVoted: null,
    ...overrides,
  } as FeedQuestion;
}

/** A single question-detail payload (useQuestionDetail data shape). */
export function makeQuestionDetail(
  overrides: Partial<FeedQuestion & { responses: Response[] }> = {}
): FeedQuestion & { responses: Response[] } {
  const base = makeFeedQuestion(overrides as Partial<FeedQuestion>);
  return {
    ...base,
    responses:
      overrides.responses ??
      [
        makeResponse({ id: 'r-1', likeCount: 5 }),
        makeResponse({
          id: 'r-2',
          likeCount: 1,
          responseText: 'Snapshot only deterministic presentational subtrees.',
          user: { id: 'u-3', firstName: 'Alan', lastName: 'Turing' },
        }),
      ],
  };
}

/** One page of the infinite feed (QuestionsFeedResult). */
export function makeFeedPage(
  count = 5,
  overrides: Partial<QuestionsFeedResult> = {}
): QuestionsFeedResult {
  const questions =
    overrides.questions ??
    Array.from({ length: count }, (_, i) => makeFeedQuestion({ id: `q-${i + 1}` }));
  return {
    questions,
    pagination: {
      page: 1,
      limit: 20,
      total: questions.length,
      totalPages: 1,
      hasMore: false,
      ...overrides.pagination,
    },
    stats: {
      totalQuestions: questions.length,
      unansweredCount: 0,
      rewardsCount: 0,
      ...overrides.stats,
    },
  };
}

/**
 * A mock of `useInfiniteQuestionsFeed`'s return value as consumed by the feed screen.
 * Override fields to drive loading / error / empty / loaded states.
 */
export function makeInfiniteFeedResult(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [makeFeedPage()], pageParams: [1] },
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetching: false,
    isRefetching: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    ...overrides,
  };
}
