/**
 * Regression tests for pre-publish builder validation (creation PR 3).
 *
 * Locks the guards that stop the builder from publishing structures that render
 * badly or block respondents — the builder previously accepted all of these and
 * so did the server/attempt path: empty-string options, inverted rating/number
 * bounds, choice types with <2 real options, and a zero/blank survey. Also
 * validates the new optional response-limit control.
 */
import { validateBuilderSurvey, type BuilderValidationInput } from '@/utils/surveyBuilderValidation';

const DAY = 24 * 60 * 60 * 1000;

function base(overrides: Partial<BuilderValidationInput> = {}): BuilderValidationInput {
  return {
    title: 'Customer pulse',
    questions: [{ text: 'Happy?', type: 'radio', options: ['Yes', 'No'] }],
    startDate: new Date(),
    endDate: new Date(Date.now() + DAY),
    maxResponses: '',
    ...overrides,
  };
}

describe('validateBuilderSurvey — rejects', () => {
  it('an empty title', () => {
    expect(validateBuilderSurvey(base({ title: '   ' })).error).toMatch(/title/i);
  });

  it('a survey with no questions', () => {
    expect(validateBuilderSurvey(base({ questions: [] })).error).toMatch(/at least one question/i);
  });

  it('a question with blank text (names the question number)', () => {
    const r = validateBuilderSurvey(base({
      questions: [
        { text: 'Ok?', type: 'text', options: [] },
        { text: '   ', type: 'text', options: [] },
      ],
    }));
    expect(r.error).toBe('Question 2 is missing its text');
  });

  it('a choice question with fewer than 2 NON-EMPTY options', () => {
    const r = validateBuilderSurvey(base({
      questions: [{ text: 'Pick', type: 'radio', options: ['Only one', '', '  '] }],
    }));
    expect(r.error).toMatch(/Question 1 \(radio\) needs at least 2 non-empty options/);
  });

  it('inverted rating bounds (min > max)', () => {
    const r = validateBuilderSurvey(base({
      questions: [{ text: 'Rate', type: 'rating', options: [], minValue: 10, maxValue: 2 }],
    }));
    expect(r.error).toMatch(/minimum cannot be greater than the maximum/i);
  });

  it('inverted number bounds (min > max)', () => {
    const r = validateBuilderSurvey(base({
      questions: [{ text: 'How many', type: 'number', options: [], minValue: 100, maxValue: 10 }],
    }));
    expect(r.error).toMatch(/minimum cannot be greater than the maximum/i);
  });

  it('end date not after start date', () => {
    const now = new Date();
    expect(validateBuilderSurvey(base({ startDate: now, endDate: now })).error).toMatch(/end date/i);
  });

  it('a non-integer or zero response limit', () => {
    expect(validateBuilderSurvey(base({ maxResponses: '0' })).error).toMatch(/whole number/i);
    expect(validateBuilderSurvey(base({ maxResponses: '12.5' })).error).toMatch(/whole number/i);
    expect(validateBuilderSurvey(base({ maxResponses: 'lots' })).error).toMatch(/whole number/i);
  });
});

describe('validateBuilderSurvey — accepts', () => {
  it('a valid survey with no response limit (unlimited)', () => {
    const r = validateBuilderSurvey(base());
    expect(r.error).toBeNull();
    expect(r.parsedMaxResponses).toBeUndefined();
  });

  it('a valid survey with a positive integer response limit', () => {
    const r = validateBuilderSurvey(base({ maxResponses: '250' }));
    expect(r.error).toBeNull();
    expect(r.parsedMaxResponses).toBe(250);
  });

  it('a choice question with exactly 2 real options plus a trailing blank', () => {
    const r = validateBuilderSurvey(base({
      questions: [{ text: 'Pick', type: 'radio', options: ['A', 'B', ''] }],
    }));
    expect(r.error).toBeNull();
  });

  it('rating/number without bounds (no inversion possible)', () => {
    const r = validateBuilderSurvey(base({
      questions: [{ text: 'Rate', type: 'rating', options: [] }],
    }));
    expect(r.error).toBeNull();
  });
});
