/**
 * Regression tests for survey template content + creation-entry resolution
 * (utils/surveyTemplates.ts) — creation PR 1.
 *
 * Locks the fix for the broken FAB entry points: "Template" and "Import" used
 * to navigate to /create-survey with a param the screen never read, landing on
 * a blank builder. resolveCreationEntry turns those params into real, loadable
 * questions; getTemplateContent gives every gallery template an actual question
 * set (previously the templates held only preview strings — nothing to load).
 */
import {
  getTemplateContent,
  hasTemplateContent,
  resolveCreationEntry,
} from '@/utils/surveyTemplates';
import { FEATURED_TEMPLATES } from '@/store/SurveyUIStore';
import type { BuilderQuestionType } from '@/store/SurveyBuilderStore';

const RENDERER_TYPES: BuilderQuestionType[] = [
  'text', 'paragraph', 'radio', 'checkbox', 'dropdown',
  'rating', 'boolean', 'date', 'time', 'number', 'file_upload',
];

describe('getTemplateContent', () => {
  it('EVERY gallery template resolves to a real, non-empty question set', () => {
    for (const tpl of FEATURED_TEMPLATES) {
      const content = getTemplateContent(tpl.id);
      expect(content).not.toBeNull();
      expect(content!.questions.length).toBeGreaterThan(0);
      expect(content!.title.length).toBeGreaterThan(0);
    }
  });

  it('produces questions only in the renderer vocabulary with unique ids', () => {
    const content = getTemplateContent('csat-standard')!;
    const ids = new Set<string>();
    for (const q of content.questions) {
      expect(RENDERER_TYPES).toContain(q.type);
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
      expect(ids.has(q.id)).toBe(false); // unique ids within a template
      ids.add(q.id);
      // choice types ship with usable options
      if (['radio', 'checkbox', 'dropdown'].includes(q.type)) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('returns null for an unknown template id', () => {
    expect(getTemplateContent('does-not-exist')).toBeNull();
    expect(hasTemplateContent('does-not-exist')).toBe(false);
    expect(hasTemplateContent('nps-simple')).toBe(true);
  });
});

describe('resolveCreationEntry', () => {
  it('parses importedQuestions JSON into loadable questions', () => {
    const imported = JSON.stringify([
      { id: 'q1', text: 'Imported one', type: 'text', options: [], required: true },
    ]);
    const content = resolveCreationEntry({ importedQuestions: imported });
    expect(content!.questions).toHaveLength(1);
    expect(content!.questions[0].text).toBe('Imported one');
  });

  it('resolves a templateId to its structured content', () => {
    const content = resolveCreationEntry({ templateId: 'nps-simple' });
    expect(content!.questions.length).toBeGreaterThan(0);
    expect(content!.title).toMatch(/NPS|Net Promoter/i);
  });

  it('returns null on malformed / empty import and unknown template', () => {
    expect(resolveCreationEntry({ importedQuestions: 'not json' })).toBeNull();
    expect(resolveCreationEntry({ importedQuestions: '[]' })).toBeNull();
    expect(resolveCreationEntry({ templateId: 'nope' })).toBeNull();
    expect(resolveCreationEntry({})).toBeNull();
  });

  it('prefers importedQuestions when both are present', () => {
    const imported = JSON.stringify([{ id: 'q1', text: 'Import wins', type: 'text', options: [], required: false }]);
    const content = resolveCreationEntry({ importedQuestions: imported, templateId: 'nps-simple' });
    expect(content!.questions).toHaveLength(1);
    expect(content!.questions[0].text).toBe('Import wins');
  });

  it('sanitizes malformed imported entries instead of trusting the raw param', () => {
    const imported = JSON.stringify([
      'not an object',
      null,
      { text: '   ' },                                  // blank → dropped
      { text: 'Keep me', type: 'wat', options: [1, 'A', null] }, // bad type→text, options filtered
      { text: 'Bounded', type: 'rating', minValue: 1, maxValue: 5, conditionalLogic: { rules: ['evil'] } },
    ]);
    const content = resolveCreationEntry({ importedQuestions: imported });
    expect(content!.questions).toHaveLength(2);
    expect(content!.questions[0]).toMatchObject({ text: 'Keep me', type: 'text', options: ['A'] });
    // untrusted conditional logic is never carried through; ids are assigned
    expect(content!.questions[1]).toMatchObject({ text: 'Bounded', type: 'rating', minValue: 1, maxValue: 5, conditionalLogic: null });
    expect(typeof content!.questions[1].id).toBe('string');
  });

  it('returns null when every imported entry is unusable', () => {
    expect(resolveCreationEntry({ importedQuestions: JSON.stringify([{ foo: 'bar' }, 5, null]) })).toBeNull();
    expect(resolveCreationEntry({ importedQuestions: JSON.stringify({ not: 'an array' }) })).toBeNull();
  });
});
