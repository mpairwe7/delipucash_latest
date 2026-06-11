/**
 * Regression tests for the builder draft's persistence sanitizer
 * (store/SurveyBuilderStore.ts#sanitizePersistedBuilderState).
 *
 * A corrupt persisted draft (truncated AsyncStorage write, bad manual edit)
 * previously flowed straight into the store and crashed the builder on open
 * with no way out short of clearing app data. The sanitizer drops any
 * structurally invalid draft ({} merges over store defaults) and still applies
 * the v0→v2 migrations to valid ones.
 */
import { sanitizePersistedBuilderState } from '@/store/SurveyBuilderStore';

const validQuestion = {
  id: 'q_1',
  type: 'radio',
  text: 'Pick one',
  options: ['A', 'B'],
  required: true,
};

describe('sanitizePersistedBuilderState — corruption guard', () => {
  it.each([
    ['null', null],
    ['a string', '"garbage"'],
    ['an array', [1, 2, 3]],
    ['questions not an array', { questions: 'oops' }],
    ['a junk question entry (null)', { questions: [validQuestion, null] }],
    ['a junk question entry (string)', { questions: ['corrupt'] }],
    ['a junk question entry (array)', { questions: [[1, 2]] }],
  ])('drops the draft when the persisted state is %s', (_label, persisted) => {
    expect(sanitizePersistedBuilderState(persisted, 2)).toEqual({});
  });

  it('keeps a structurally valid draft intact at the current version', () => {
    const state = {
      surveyTitle: 'My survey',
      questions: [{ ...validQuestion, conditionalLogic: null, fileUploadConfig: null, points: 0 }],
      isScoringEnabled: false,
      earnedBadges: [],
    };
    expect(sanitizePersistedBuilderState(state, 2)).toEqual(state);
  });
});

describe('sanitizePersistedBuilderState — migrations', () => {
  it('v0 → adds conditionalLogic/fileUploadConfig/earnedBadges and v<2 fields', () => {
    const migrated = sanitizePersistedBuilderState(
      { questions: [validQuestion] },
      0
    ) as { questions: Record<string, unknown>[]; earnedBadges: unknown; isScoringEnabled: unknown };

    expect(migrated.questions[0]).toMatchObject({
      ...validQuestion,
      conditionalLogic: null,
      fileUploadConfig: null,
      points: 0,
    });
    expect(migrated.earnedBadges).toEqual([]);
    expect(migrated.isScoringEnabled).toBe(false);
  });

  it('v1 → adds points + isScoringEnabled without touching existing values', () => {
    const migrated = sanitizePersistedBuilderState(
      { questions: [{ ...validQuestion, conditionalLogic: null, points: 5 }], earnedBadges: ['first_question'] },
      1
    ) as { questions: Record<string, unknown>[]; earnedBadges: unknown; isScoringEnabled: unknown };

    expect(migrated.questions[0].points).toBe(5); // preserved, not reset
    expect(migrated.earnedBadges).toEqual(['first_question']);
    expect(migrated.isScoringEnabled).toBe(false);
  });
});
