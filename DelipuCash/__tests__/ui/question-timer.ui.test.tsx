/**
 * Regression tests for QuestionTimer — the timed reward countdown.
 *
 * The timer must be WALL-CLOCK based, not a setInterval-on-state decrement. The old
 * implementation paused whenever the app was backgrounded or the JS thread was starved,
 * handing the user free time in a timed cash game (and disagreeing with the server's
 * real expiry). These tests lock in that elapsed real time always counts — even if
 * interval ticks were skipped.
 */
import React from 'react';
import { renderWithProviders, screen, act } from '@/test-utils';
import { QuestionTimer } from '@/components/quiz/QuestionTimer';

describe('QuestionTimer — wall-clock countdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });
  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  // advanceTimersByTime advances the mocked Date.now() too, so don't also setSystemTime.
  const advance = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  it('counts down from the limit as real time elapses', () => {
    renderWithProviders(<QuestionTimer timeLimit={10} />);
    expect(screen.getByText('10s')).toBeOnTheScreen();
    advance(3000);
    expect(screen.getByText('7s')).toBeOnTheScreen();
  });

  it('does NOT grant free time when interval ticks were skipped (expires on the wall clock)', () => {
    const onExpired = jest.fn();
    renderWithProviders(<QuestionTimer timeLimit={5} onTimeExpired={onExpired} />);

    // Simulate the app being backgrounded for 6s: jump the system clock past the
    // 5s deadline but run only ONE interval tick (as if 5 ticks were skipped).
    act(() => {
      jest.setSystemTime(Date.now() + 6000);
      jest.advanceTimersByTime(1000);
    });

    // Old (decrement) behaviour would show "4s" and not expire. Wall-clock expires.
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0s')).toBeOnTheScreen();
  });

  it('fires the expiry callback exactly once', () => {
    const onExpired = jest.fn();
    renderWithProviders(<QuestionTimer timeLimit={2} onTimeExpired={onExpired} />);
    advance(3000); // well past expiry, multiple ticks
    advance(2000); // keep ticking after expiry
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
