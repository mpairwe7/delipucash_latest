/**
 * Survey question-type vocabulary — single source of truth for the SERVER.
 *
 * VALID_QUESTION_TYPES mirrors exactly what the mobile app can build
 * (store/SurveyBuilderStore.ts#BuilderQuestionType) and render
 * (app/survey/[id].tsx renderer switch + isAnswerValid). Anything outside this
 * list bricks the attempt flow: the renderer default-cases unknown types to a
 * text input, but isAnswerValid() returns false for them — a REQUIRED question
 * of an unknown type permanently disables the Next button.
 *
 * TYPE_ALIASES maps the legacy createSurvey vocabulary (which never matched the
 * renderer) onto real types so old API clients keep working.
 */

export const VALID_QUESTION_TYPES = [
  'text',
  'paragraph',
  'radio',
  'checkbox',
  'dropdown',
  'rating',
  'boolean',
  'date',
  'time',
  'number',
  'file_upload',
];

export const TYPE_ALIASES = {
  textarea: 'paragraph',
  multiple_choice: 'radio',
  nps: 'rating',
  slider: 'rating',
};

/**
 * Normalize a client-supplied question type: trims, lowercases, applies legacy
 * aliases. Returns the canonical type, or null when the type is not in the
 * renderer vocabulary (callers should 400 with the valid list).
 */
export function normalizeQuestionType(rawType) {
  if (typeof rawType !== 'string') return null;
  const lowered = rawType.trim().toLowerCase();
  const canonical = TYPE_ALIASES[lowered] || lowered;
  return VALID_QUESTION_TYPES.includes(canonical) ? canonical : null;
}
