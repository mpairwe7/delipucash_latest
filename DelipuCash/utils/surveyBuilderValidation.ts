/**
 * Pre-publish validation for the survey builder (SurveyForm).
 *
 * Mirrors the server's creation guards and protects the attempt renderer from
 * structures that publish but render badly or block respondents:
 *  - empty survey / missing question text
 *  - choice questions with fewer than 2 NON-EMPTY options (a blank option is a
 *    selectable empty row that submits "" — indistinguishable from no answer)
 *  - inverted rating/number bounds (min > max)
 *  - end date not after start date
 *  - a response limit that isn't a positive whole number
 *
 * Pure + UI-free so the rules can be unit-tested without rendering the screen.
 * Returns the first human-readable error (naming the offending question, 1-based)
 * or null when valid, plus the parsed response cap.
 */

const CHOICE_TYPES = ['radio', 'checkbox', 'dropdown'];

export interface BuilderValidationQuestion {
  text: string;
  type: string;
  options: string[];
  minValue?: number | null;
  maxValue?: number | null;
}

export interface BuilderValidationInput {
  title: string;
  questions: BuilderValidationQuestion[];
  startDate: Date;
  endDate: Date;
  /** Raw text from the "Response limit" input ('' = unlimited). */
  maxResponses: string;
}

export interface BuilderValidationResult {
  error: string | null;
  /** Parsed cap when provided and valid; undefined means unlimited. */
  parsedMaxResponses?: number;
}

export function validateBuilderSurvey(input: BuilderValidationInput): BuilderValidationResult {
  const { title, questions, startDate, endDate } = input;

  if (!title.trim()) {
    return { error: 'Please enter a survey title' };
  }

  if (questions.length === 0) {
    return { error: 'Add at least one question before publishing' };
  }

  const emptyTextIndex = questions.findIndex((q) => !q.text.trim());
  if (emptyTextIndex !== -1) {
    return { error: `Question ${emptyTextIndex + 1} is missing its text` };
  }

  const badOptionIndex = questions.findIndex(
    (q) => CHOICE_TYPES.includes(q.type) && q.options.filter((o) => o.trim().length > 0).length < 2,
  );
  if (badOptionIndex !== -1) {
    return {
      error: `Question ${badOptionIndex + 1} (${questions[badOptionIndex].type}) needs at least 2 non-empty options`,
    };
  }

  const invertedIndex = questions.findIndex(
    (q) =>
      (q.type === 'rating' || q.type === 'number') &&
      q.minValue != null &&
      q.maxValue != null &&
      q.minValue > q.maxValue,
  );
  if (invertedIndex !== -1) {
    return { error: `Question ${invertedIndex + 1}: the minimum cannot be greater than the maximum` };
  }

  if (startDate >= endDate) {
    return { error: 'End date must be after start date' };
  }

  const trimmedCap = input.maxResponses.trim();
  if (trimmedCap) {
    const parsed = Number(trimmedCap);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { error: 'Response limit must be a whole number of 1 or more' };
    }
    return { error: null, parsedMaxResponses: parsed };
  }

  return { error: null, parsedMaxResponses: undefined };
}
