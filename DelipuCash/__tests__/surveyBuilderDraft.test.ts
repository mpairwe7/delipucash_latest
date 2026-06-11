/**
 * Tests for builderHasUserContent (creation PR 5) — the predicate behind the
 * "replace draft?" and "leave without publishing?" confirmations. The builder
 * seeds a single blank default question; only beyond that is it the user's work.
 */
import { builderHasUserContent } from '@/utils/surveyBuilderDraft';

it('is false for an empty builder or the single blank default question', () => {
  expect(builderHasUserContent([])).toBe(false);
  expect(builderHasUserContent([{ text: '' }])).toBe(false);
  expect(builderHasUserContent([{ text: '   ' }])).toBe(false);
});

it('is true once the single question has text', () => {
  expect(builderHasUserContent([{ text: 'How satisfied?' }])).toBe(true);
});

it('is true whenever there is more than one question', () => {
  expect(builderHasUserContent([{ text: '' }, { text: '' }])).toBe(true);
});
