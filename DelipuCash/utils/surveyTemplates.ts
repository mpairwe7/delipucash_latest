/**
 * Structured survey template definitions.
 *
 * The gallery (FEATURED_TEMPLATES in store/SurveyUIStore.ts) holds only display
 * metadata + a couple of preview strings — there were no real, loadable
 * questions behind a template, so "use template" produced a blank builder. This
 * module provides the actual question sets, keyed by the same template ids, as
 * editable BuilderQuestionData[]. Selecting a template loads these into the
 * builder where the creator edits freely (Google-Forms-style starting point),
 * then publishes.
 *
 * Types use the renderer vocabulary (BuilderQuestionType). No conditional logic
 * here — templates are a clean starting point; creators add branching in the
 * editor.
 */

import type { BuilderQuestionData, BuilderQuestionType } from '@/store/SurveyBuilderStore';

export interface TemplateContent {
  title: string;
  description: string;
  questions: BuilderQuestionData[];
}

interface SeedQuestion {
  text: string;
  type: BuilderQuestionType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
}

let templateQuestionCounter = 0;
function toBuilderQuestion(seed: SeedQuestion): BuilderQuestionData {
  templateQuestionCounter += 1;
  return {
    // Distinct prefix so a template's ids never collide with builder-generated
    // ids (q_<ts>_<n>); the server remaps conditional-logic refs on publish.
    id: `tpl_${Date.now()}_${templateQuestionCounter}`,
    text: seed.text,
    type: seed.type,
    options: seed.options ?? [],
    required: seed.required ?? false,
    placeholder: seed.placeholder,
    minValue: seed.minValue,
    maxValue: seed.maxValue,
    conditionalLogic: null,
    fileUploadConfig: null,
    points: 0,
  };
}

// Seed definitions keyed by the FEATURED_TEMPLATES ids.
const TEMPLATE_SEEDS: Record<string, { title: string; description: string; questions: SeedQuestion[] }> = {
  'nps-simple': {
    title: 'Net Promoter Score (NPS)',
    description: 'Measure customer loyalty with the classic NPS question and a follow-up.',
    questions: [
      { text: 'How likely are you to recommend us to a friend or colleague?', type: 'rating', minValue: 0, maxValue: 10, required: true },
      { text: 'What is the primary reason for your score?', type: 'paragraph', placeholder: 'Tell us more…', required: false },
      { text: 'What is one thing we could do to improve?', type: 'paragraph', placeholder: 'Optional', required: false },
    ],
  },
  'csat-standard': {
    title: 'Customer Satisfaction (CSAT)',
    description: 'A comprehensive satisfaction survey across key touchpoints.',
    questions: [
      { text: 'Overall, how satisfied are you with our product or service?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'How would you rate the quality of our customer support?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'How easy was it to get what you needed?', type: 'radio', options: ['Very easy', 'Easy', 'Neutral', 'Difficult', 'Very difficult'], required: true },
      { text: 'Which areas could we improve? (select all that apply)', type: 'checkbox', options: ['Product quality', 'Pricing', 'Support', 'Delivery', 'Website experience'], required: false },
      { text: 'How likely are you to purchase from us again?', type: 'radio', options: ['Definitely', 'Probably', 'Not sure', 'Probably not', 'Definitely not'], required: true },
      { text: 'What did we do well?', type: 'paragraph', placeholder: 'Optional', required: false },
      { text: 'What should we do differently?', type: 'paragraph', placeholder: 'Optional', required: false },
      { text: 'May we contact you about your feedback?', type: 'boolean', options: ['Yes', 'No'], required: false },
    ],
  },
  'employee-pulse': {
    title: 'Employee Pulse Check',
    description: 'A quick weekly check-in to gauge team morale and engagement.',
    questions: [
      { text: 'How are you feeling about your work this week?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'Do you have the resources you need to succeed?', type: 'radio', options: ['Yes, fully', 'Mostly', 'Somewhat', 'Not really'], required: true },
      { text: 'How manageable is your current workload?', type: 'radio', options: ['Too light', 'Just right', 'A bit heavy', 'Overwhelming'], required: true },
      { text: 'How supported do you feel by your manager?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'Anything you would like to share with the team?', type: 'paragraph', placeholder: 'Optional and confidential', required: false },
    ],
  },
  'product-discovery': {
    title: 'Product Discovery',
    description: 'Understand user needs and validate ideas before building.',
    questions: [
      { text: 'What problem are you trying to solve today?', type: 'paragraph', placeholder: 'Describe in your own words', required: true },
      { text: 'How are you solving this problem right now?', type: 'paragraph', placeholder: 'Current workaround or tool', required: false },
      { text: 'How often do you run into this problem?', type: 'radio', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'], required: true },
      { text: 'How important is solving this to you?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'Which features would be most valuable? (select all)', type: 'checkbox', options: ['Speed', 'Ease of use', 'Integrations', 'Price', 'Support'], required: false },
      { text: 'Would you pay for a solution to this problem?', type: 'boolean', options: ['Yes', 'No'], required: false },
    ],
  },
  'event-post': {
    title: 'Event Feedback',
    description: 'Collect attendee feedback after an event or session.',
    questions: [
      { text: 'How would you rate the event overall?', type: 'rating', minValue: 1, maxValue: 5, required: true },
      { text: 'Which session did you find most valuable?', type: 'text', placeholder: 'Session name', required: false },
      { text: 'How well organized was the event?', type: 'radio', options: ['Excellent', 'Good', 'Fair', 'Poor'], required: true },
      { text: 'Would you attend again?', type: 'boolean', options: ['Yes', 'No'], required: true },
      { text: 'What could we improve for next time?', type: 'paragraph', placeholder: 'Optional', required: false },
    ],
  },
  'market-segmentation': {
    title: 'Market Research',
    description: 'Gather demographic and preference data for market analysis.',
    questions: [
      { text: 'What is your age range?', type: 'dropdown', options: ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'], required: true },
      { text: 'How did you first hear about us?', type: 'radio', options: ['Social media', 'Friend or colleague', 'Search', 'Advertisement', 'Other'], required: true },
      { text: 'How often do you purchase products in this category?', type: 'radio', options: ['Weekly', 'Monthly', 'A few times a year', 'Rarely'], required: true },
      { text: 'What matters most when choosing a product? (select all)', type: 'checkbox', options: ['Price', 'Quality', 'Brand', 'Reviews', 'Availability'], required: false },
      { text: 'What is your typical budget for this category?', type: 'number', placeholder: 'Amount', required: false },
    ],
  },
};

/**
 * Resolve a template id to its loadable content. Returns null for unknown ids
 * (caller should leave the builder untouched).
 */
export function getTemplateContent(templateId: string): TemplateContent | null {
  const seed = TEMPLATE_SEEDS[templateId];
  if (!seed) return null;
  return {
    title: seed.title,
    description: seed.description,
    questions: seed.questions.map(toBuilderQuestion),
  };
}

/** Whether a structured definition exists for a template id (gallery can gate on this). */
export function hasTemplateContent(templateId: string): boolean {
  return templateId in TEMPLATE_SEEDS;
}

const RENDERER_TYPES: BuilderQuestionType[] = [
  'text', 'paragraph', 'radio', 'checkbox', 'dropdown',
  'rating', 'boolean', 'date', 'time', 'number', 'file_upload',
];

/**
 * Coerce arbitrary parsed JSON (from the importedQuestions route param) into
 * well-formed BuilderQuestionData. The param is serialized by our own
 * ImportWizard, but a truncated/edited/foreign value must never reach the
 * builder as malformed data — entries without usable text are dropped, the
 * type is constrained to the renderer vocabulary, and every field is coerced to
 * its expected shape. Untrusted conditional logic is not carried through.
 */
function sanitizeImportedQuestions(parsed: unknown): BuilderQuestionData[] {
  if (!Array.isArray(parsed)) return [];
  const out: BuilderQuestionData[] = [];
  parsed.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const q = raw as Record<string, unknown>;
    const text = typeof q.text === 'string' ? q.text.trim() : '';
    if (!text) return; // unusable — skip

    const type = typeof q.type === 'string' && (RENDERER_TYPES as string[]).includes(q.type)
      ? (q.type as BuilderQuestionType)
      : 'text';
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === 'string')
      : [];
    const min = typeof q.minValue === 'number' && Number.isFinite(q.minValue) ? q.minValue : undefined;
    const max = typeof q.maxValue === 'number' && Number.isFinite(q.maxValue) ? q.maxValue : undefined;

    out.push({
      id: typeof q.id === 'string' && q.id ? q.id : `imported_${i + 1}`,
      text,
      type,
      options,
      minValue: min,
      maxValue: max,
      placeholder: typeof q.placeholder === 'string' ? q.placeholder : undefined,
      required: q.required === true,
      conditionalLogic: null,
      fileUploadConfig: null,
      points: typeof q.points === 'number' && Number.isFinite(q.points) ? q.points : 0,
    });
  });
  return out;
}

/**
 * Resolve a creation-entry param set (from the FAB) to loadable builder content.
 * `importedQuestions` is a JSON-serialized question array (validated/coerced via
 * sanitizeImportedQuestions); `templateId` resolves to a structured template.
 * Returns null when neither yields content (unknown template, malformed/empty
 * import) — the caller leaves the builder untouched. Pure + side-effect-free so
 * it can be unit-tested without rendering the screen.
 */
export function resolveCreationEntry(params: {
  importedQuestions?: string | null;
  templateId?: string | null;
}): TemplateContent | null {
  if (params.importedQuestions) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(params.importedQuestions);
    } catch {
      return null;
    }
    const questions = sanitizeImportedQuestions(parsed);
    return questions.length > 0 ? { title: '', description: '', questions } : null;
  }
  if (params.templateId) {
    return getTemplateContent(params.templateId);
  }
  return null;
}
