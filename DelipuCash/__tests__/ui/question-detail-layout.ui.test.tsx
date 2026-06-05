/**
 * UI-consistency + a11y regression tests for the shared question-detail presentational
 * components (components/question/QuestionDetailLayout.tsx). These have no router/data
 * dependencies, so they're the most stable contract to lock first.
 *
 * Covers: transformResponses (pure), ResponseCard, QuestionDetailHeader,
 * QuestionHeroCard, QuestionDetailError, AnswerInput.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test-utils';
import {
  ResponseCard,
  QuestionDetailHeader,
  QuestionHeroCard,
  QuestionDetailError,
  AnswerInput,
  transformResponses,
} from '@/components/question/QuestionDetailLayout';
import { useTheme } from '@/utils/theme';
import { makeResponse, makeFeedQuestion } from '@/__tests__/fixtures/question.factory';
import type { Response } from '@/types';

// Pin date/currency formatting so snapshots are deterministic regardless of the clock
// or locale. Other assertions in this file don't depend on the exact formatted output.
jest.mock('@/services/api', () => ({
  ...jest.requireActual('@/services/api'),
  formatDate: () => 'Jun 1, 2026',
  formatCurrency: (n: number) => `UGX ${n}`,
}));

// ResponseCard takes `colors` as a prop — wrap so it reads the live theme.
function ThemedResponseCard(props: Omit<React.ComponentProps<typeof ResponseCard>, 'colors'>) {
  const { colors } = useTheme();
  return <ResponseCard {...props} colors={colors} />;
}

describe('transformResponses', () => {
  it('returns an empty array for undefined or empty input', () => {
    expect(transformResponses(undefined)).toEqual([]);
    expect(transformResponses([])).toEqual([]);
  });

  it('marks the single highest-liked response (>0) as accepted', () => {
    const result = transformResponses([
      makeResponse({ id: 'a', likeCount: 1 }),
      makeResponse({ id: 'b', likeCount: 7 }),
      makeResponse({ id: 'c', likeCount: 3 }),
    ]);
    expect(result.find((r) => r.id === 'b')?.isAccepted).toBe(true);
    expect(result.filter((r) => r.isAccepted)).toHaveLength(1);
  });

  it('does not mark any response accepted when all have zero likes', () => {
    const result = transformResponses([
      makeResponse({ id: 'a', likeCount: 0 }),
      makeResponse({ id: 'b', likeCount: 0 }),
    ]);
    expect(result.some((r) => r.isAccepted)).toBe(false);
  });

  it('derives userName from the author and falls back to Anonymous', () => {
    const [named, anon] = transformResponses([
      makeResponse({ id: 'a', user: { id: 'u', firstName: 'Ada', lastName: 'Lovelace' } }),
      makeResponse({ id: 'b', user: undefined }),
    ]);
    expect(named.userName).toBe('Ada Lovelace');
    expect(anon.userName).toBe('Anonymous');
  });

  it('falls back to the deprecated likesCount/dislikesCount fields', () => {
    const [r] = transformResponses([
      { id: 'a', responseText: 'x', createdAt: 'now', likesCount: 4, dislikesCount: 1 } as unknown as Response,
    ]);
    expect(r.likeCount).toBe(4);
    expect(r.dislikeCount).toBe(1);
  });
});

describe('ResponseCard', () => {
  const baseResponse = {
    id: 'r-1',
    userName: 'Ada Lovelace',
    responseText: 'Use RNTL with jest-expo.',
    createdAt: '2026-06-01T09:00:00.000Z',
    likeCount: 2,
    dislikeCount: 0,
  };

  it('renders author, text, and an accessible summary label', () => {
    renderWithProviders(<ThemedResponseCard response={baseResponse} />);
    expect(screen.getByText('Ada Lovelace')).toBeOnTheScreen();
    expect(screen.getByText('Use RNTL with jest-expo.')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Response by Ada Lovelace. 2 likes, 0 dislikes')
    ).toBeOnTheScreen();
  });

  it('exposes labelled like and dislike buttons and fires their callbacks', () => {
    const onLike = jest.fn();
    const onDislike = jest.fn();
    renderWithProviders(
      <ThemedResponseCard response={baseResponse} onLike={onLike} onDislike={onDislike} />
    );
    fireEvent.press(screen.getByLabelText('Like. 2 likes'));
    fireEvent.press(screen.getByLabelText('Dislike. 0 dislikes'));
    expect(onLike).toHaveBeenCalledWith('r-1');
    expect(onDislike).toHaveBeenCalledWith('r-1');
  });

  it('reflects optimistic like state by incrementing the displayed count', () => {
    renderWithProviders(<ThemedResponseCard response={baseResponse} isLiked onLike={jest.fn()} />);
    // 2 stored + 1 optimistic = 3, and the button is marked selected
    const likeButton = screen.getByLabelText('Like. 3 likes');
    expect(likeButton).toBeOnTheScreen();
    expect(likeButton).toBeSelected();
  });

  it('hides the like/dislike action row when no handlers are supplied', () => {
    renderWithProviders(<ThemedResponseCard response={baseResponse} />);
    expect(screen.queryByLabelText(/^Like\./)).toBeNull();
    expect(screen.queryByLabelText(/^Dislike\./)).toBeNull();
  });

  it('appends "Accepted answer" to the summary label for the accepted response', () => {
    renderWithProviders(
      <ThemedResponseCard response={{ ...baseResponse, isAccepted: true }} />
    );
    expect(
      screen.getByLabelText('Response by Ada Lovelace. 2 likes, 0 dislikes. Accepted answer')
    ).toBeOnTheScreen();
  });
});

describe('QuestionDetailHeader', () => {
  it('renders title + subtitle and a labelled back button that fires onBack', () => {
    const onBack = jest.fn();
    renderWithProviders(
      <QuestionDetailHeader title="Discussion" subtitle="A question?" onBack={onBack} />
    );
    expect(screen.getByText('Discussion')).toBeOnTheScreen();
    expect(screen.getByText('A question?')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('QuestionHeroCard', () => {
  it('renders the question text, category badge, and answer count', () => {
    const question = makeFeedQuestion({ text: 'Why test?', category: 'Technology', totalAnswers: 4 });
    renderWithProviders(<QuestionHeroCard question={question} />);
    expect(screen.getByText('Why test?')).toBeOnTheScreen();
    expect(screen.getByText('Technology')).toBeOnTheScreen();
    expect(screen.getByText('4 answers')).toBeOnTheScreen();
  });

  it('shows a reward row only when a reward amount is present', () => {
    const { rerender } = renderWithProviders(
      <QuestionHeroCard question={makeFeedQuestion({ rewardAmount: 0 })} />
    );
    expect(screen.queryByText(/Earn/)).toBeNull();

    rerender(<QuestionHeroCard question={makeFeedQuestion({ rewardAmount: 500 })} />);
    expect(screen.getByText(/Earn/)).toBeOnTheScreen();
  });
});

describe('QuestionDetailError', () => {
  it('renders the message with a retry action that fires onRetry', () => {
    const onRetry = jest.fn();
    renderWithProviders(<QuestionDetailError message="Question not found" onRetry={onRetry} />);
    expect(screen.getByText('Question not found')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    // "Go back" is always offered as a secondary action.
    expect(screen.getByRole('button', { name: 'Go back' })).toBeOnTheScreen();
  });

  it('omits the retry action when no onRetry is provided', () => {
    renderWithProviders(<QuestionDetailError message="Gone" />);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('AnswerInput', () => {
  const noop = () => {};

  it('renders the labelled input and remaining-character count (full mode)', () => {
    renderWithProviders(
      <AnswerInput value="hello" onChangeText={noop} onSubmit={noop} maxLength={500} />
    );
    expect(screen.getByLabelText('Answer input')).toBeOnTheScreen();
    expect(screen.getByText('495 left')).toBeOnTheScreen(); // 500 - 5
  });

  it('disables submit until the answer reaches the 10-char minimum', () => {
    const onSubmit = jest.fn();
    const { rerender } = renderWithProviders(
      <AnswerInput value="short" onChangeText={noop} onSubmit={onSubmit} />
    );
    expect(screen.getByRole('button', { name: 'Submit Answer' })).toBeDisabled();

    rerender(
      <AnswerInput value="a long enough answer" onChangeText={noop} onSubmit={onSubmit} />
    );
    const submit = screen.getByRole('button', { name: 'Submit Answer' });
    expect(submit).toBeEnabled();
    fireEvent.press(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('uses the compact Send affordance in compact mode', () => {
    renderWithProviders(
      <AnswerInput value="a long enough answer" onChangeText={noop} onSubmit={noop} compact />
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});

/**
 * Narrow structural snapshots — only small, deterministic presentational subtrees with
 * fixed props (no whole-screen snapshots). Date/currency are pinned above; the theme is
 * the deterministic default (dark). Update intentionally with `bun run test:update-snapshots`.
 */
describe('presentational snapshots', () => {
  const response = {
    id: 'r-1',
    userName: 'Ada Lovelace',
    responseText: 'Use RNTL with jest-expo.',
    createdAt: '2026-06-01T09:00:00.000Z',
    likeCount: 2,
    dislikeCount: 0,
  };

  it('ResponseCard — default', () => {
    const { toJSON } = renderWithProviders(
      <ThemedResponseCard response={response} onLike={() => {}} onDislike={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('ResponseCard — accepted', () => {
    const { toJSON } = renderWithProviders(
      <ThemedResponseCard response={{ ...response, isAccepted: true }} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('QuestionHeroCard — without reward', () => {
    const { toJSON } = renderWithProviders(
      <QuestionHeroCard question={makeFeedQuestion({ rewardAmount: 0 })} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('QuestionHeroCard — with reward', () => {
    const { toJSON } = renderWithProviders(
      <QuestionHeroCard question={makeFeedQuestion({ rewardAmount: 500 })} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('QuestionDetailHeader', () => {
    const { toJSON } = renderWithProviders(
      <QuestionDetailHeader title="Discussion" subtitle="A question?" onBack={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('QuestionDetailError — with retry', () => {
    const { toJSON } = renderWithProviders(
      <QuestionDetailError message="Question not found" onRetry={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
