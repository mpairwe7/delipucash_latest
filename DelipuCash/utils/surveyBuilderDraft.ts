/**
 * Draft-state helpers for the survey builder.
 *
 * "User content" = the builder holds more than the single blank default
 * question. Used to decide when to confirm before replacing the draft (loading
 * a template/import/AI draft) or before discarding it (exiting the screen), so
 * a creator never silently loses in-progress work.
 */

export interface DraftQuestionLike {
  text: string;
}

export function builderHasUserContent(questions: DraftQuestionLike[]): boolean {
  if (questions.length > 1) return true;
  return questions.length === 1 && questions[0].text.trim().length > 0;
}
