/**
 * Unit regression tests for SurveyAttemptStore navigation bounds.
 *
 * The take screen renders the *visible* question set (conditional logic hides/shows
 * questions), while the store owns `currentQuestionIndex` and the navigation guards.
 * Before the fix, `totalQuestions` was frozen at the full upload count, so `goNext`
 * and `setCurrentIndex` could advance past the last *reachable* question into an
 * `undefined` slot. `setTotalQuestions` keeps the store's count in sync with the
 * visible set, so navigation can never overshoot. These tests lock that in.
 */
import { useSurveyAttemptStore } from '@/store/SurveyAttemptStore';

const store = () => useSurveyAttemptStore.getState();

beforeEach(() => {
  store().reset();
});

describe('SurveyAttemptStore — setTotalQuestions', () => {
  it('updates the active question count', () => {
    store().startAttempt('s-1', 5);
    expect(store().totalQuestions).toBe(5);

    store().setTotalQuestions(3);
    expect(store().totalQuestions).toBe(3);
  });

  it('clamps currentQuestionIndex down when the visible set shrinks', () => {
    store().startAttempt('s-1', 5);
    store().setCurrentIndex(4); // on the last of 5
    expect(store().currentQuestionIndex).toBe(4);

    // Conditional logic hides two questions → only 3 remain visible.
    store().setTotalQuestions(3);
    expect(store().totalQuestions).toBe(3);
    expect(store().currentQuestionIndex).toBe(2); // clamped to last visible
  });

  it('leaves a still-valid currentQuestionIndex untouched', () => {
    store().startAttempt('s-1', 5);
    store().setCurrentIndex(1);

    store().setTotalQuestions(3);
    expect(store().currentQuestionIndex).toBe(1);
  });

  it('does not clamp to -1 when the visible set is momentarily empty', () => {
    store().startAttempt('s-1', 5);
    store().setCurrentIndex(2);

    store().setTotalQuestions(0); // transient (e.g. survey still loading)
    expect(store().currentQuestionIndex).toBe(2); // unchanged, never negative
  });
});

describe('SurveyAttemptStore — navigation respects the visible count', () => {
  it('goNext cannot advance past the last visible question', () => {
    store().startAttempt('s-1', 5);
    // Visible set is only 2 questions (conditional logic hid 3).
    store().setTotalQuestions(2);
    store().setCurrentIndex(1); // last visible

    store().goNext();
    expect(store().currentQuestionIndex).toBe(1); // stayed — did NOT overshoot to 2

    // Reveal the hidden questions again; now goNext may advance.
    store().setTotalQuestions(5);
    store().goNext();
    expect(store().currentQuestionIndex).toBe(2);
  });

  it('setCurrentIndex ignores an index beyond the visible count', () => {
    store().startAttempt('s-1', 5);
    store().setTotalQuestions(2);

    store().setCurrentIndex(4); // out of the visible range
    expect(store().currentQuestionIndex).toBe(0); // rejected, index unchanged
  });
});
