/**
 * Unit tests for the survey conditional-logic engine (utils/conditionalLogic.ts).
 *
 * This is the pure branching engine the respondent survey screen (app/survey/[id].tsx)
 * relies on to show/hide questions. It has zero React deps, so it's tested directly here —
 * the survey analog of locking the question screens' pure transform logic. Every exported
 * function + every operator branch is covered so a silent change in visibility rules fails CI.
 */
import {
  evaluateCondition,
  evaluateConditions,
  isQuestionVisible,
  getVisibleQuestions,
  validateConditionalLogic,
  getOperatorsForType,
  getOperatorLabel,
  operatorRequiresValue,
  type AnswerMap,
} from '@/utils/conditionalLogic';
import type { ConditionalRule, ConditionalLogicConfig } from '@/store/SurveyBuilderStore';

const rule = (overrides: Partial<ConditionalRule> = {}): ConditionalRule => ({
  sourceQuestionId: 'q1',
  operator: 'equals',
  value: 'yes',
  action: 'show',
  ...overrides,
});

const config = (
  rules: ConditionalRule[],
  logicType: ConditionalLogicConfig['logicType'] = 'all'
): ConditionalLogicConfig => ({ rules, logicType });

describe('evaluateCondition — per operator', () => {
  it('is_empty is true for null/undefined/""/[] and false otherwise', () => {
    const r = rule({ operator: 'is_empty' });
    expect(evaluateCondition(r, { q1: null })).toBe(true);
    expect(evaluateCondition(r, {})).toBe(true); // undefined
    expect(evaluateCondition(r, { q1: '' })).toBe(true);
    expect(evaluateCondition(r, { q1: [] })).toBe(true);
    expect(evaluateCondition(r, { q1: 'x' })).toBe(false);
    expect(evaluateCondition(r, { q1: ['a'] })).toBe(false);
  });

  it('is_not_empty is the inverse of is_empty', () => {
    const r = rule({ operator: 'is_not_empty' });
    expect(evaluateCondition(r, { q1: 'x' })).toBe(true);
    expect(evaluateCondition(r, { q1: ['a'] })).toBe(true);
    expect(evaluateCondition(r, { q1: '' })).toBe(false);
    expect(evaluateCondition(r, { q1: [] })).toBe(false);
    expect(evaluateCondition(r, { q1: null })).toBe(false);
  });

  it('equals compares as strings, and uses includes() for array (checkbox) answers', () => {
    expect(evaluateCondition(rule({ operator: 'equals', value: 'yes' }), { q1: 'yes' })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'equals', value: 'yes' }), { q1: 'no' })).toBe(false);
    // numeric coercion: 5 === '5'
    expect(evaluateCondition(rule({ operator: 'equals', value: 5 }), { q1: 5 })).toBe(true);
    // checkbox array contains the value
    expect(evaluateCondition(rule({ operator: 'equals', value: 'opt_b' }), { q1: ['opt_a', 'opt_b'] })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'equals', value: 'opt_z' }), { q1: ['opt_a', 'opt_b'] })).toBe(false);
  });

  it('not_equals is the inverse of equals (scalar and array)', () => {
    expect(evaluateCondition(rule({ operator: 'not_equals', value: 'yes' }), { q1: 'no' })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'not_equals', value: 'yes' }), { q1: 'yes' })).toBe(false);
    expect(evaluateCondition(rule({ operator: 'not_equals', value: 'opt_b' }), { q1: ['opt_a'] })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'not_equals', value: 'opt_a' }), { q1: ['opt_a'] })).toBe(false);
  });

  it('contains is a case-insensitive substring (joins arrays with commas)', () => {
    expect(evaluateCondition(rule({ operator: 'contains', value: 'GREAT' }), { q1: 'this is great' })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'contains', value: 'bad' }), { q1: 'this is great' })).toBe(false);
    expect(evaluateCondition(rule({ operator: 'contains', value: 'b' }), { q1: ['apple', 'banana'] })).toBe(true);
    // undefined answer coerces to '' and never contains a non-empty needle
    expect(evaluateCondition(rule({ operator: 'contains', value: 'x' }), {})).toBe(false);
  });

  it('greater_than / less_than coerce to numbers and guard NaN', () => {
    expect(evaluateCondition(rule({ operator: 'greater_than', value: 3 }), { q1: 5 })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'greater_than', value: 3 }), { q1: 2 })).toBe(false);
    expect(evaluateCondition(rule({ operator: 'less_than', value: 3 }), { q1: 2 })).toBe(true);
    expect(evaluateCondition(rule({ operator: 'less_than', value: 3 }), { q1: 5 })).toBe(false);
    // non-numeric answer → NaN → false for both
    expect(evaluateCondition(rule({ operator: 'greater_than', value: 3 }), { q1: 'abc' })).toBe(false);
    expect(evaluateCondition(rule({ operator: 'less_than', value: 3 }), { q1: 'abc' })).toBe(false);
  });

  it('defaults to visible (true) for an unknown operator', () => {
    // Cast through unknown — exercises the switch default branch.
    const weird = { sourceQuestionId: 'q1', operator: 'matches_regex', value: 'x' } as unknown as ConditionalRule;
    expect(evaluateCondition(weird, { q1: 'anything' })).toBe(true);
  });
});

describe('evaluateConditions — AND / OR combination', () => {
  const answers: AnswerMap = { q1: 'yes', q2: 10 };

  it('returns true when there are no rules', () => {
    expect(evaluateConditions(config([]), answers)).toBe(true);
  });

  it("'all' requires every rule to pass (AND)", () => {
    const allPass = config(
      [rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'yes' }), rule({ sourceQuestionId: 'q2', operator: 'greater_than', value: 5 })],
      'all'
    );
    const oneFails = config(
      [rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'yes' }), rule({ sourceQuestionId: 'q2', operator: 'greater_than', value: 50 })],
      'all'
    );
    expect(evaluateConditions(allPass, answers)).toBe(true);
    expect(evaluateConditions(oneFails, answers)).toBe(false);
  });

  it("'any' requires at least one rule to pass (OR)", () => {
    const oneFailsOnePasses = config(
      [rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'no' }), rule({ sourceQuestionId: 'q2', operator: 'greater_than', value: 5 })],
      'any'
    );
    const allFail = config(
      [rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'no' }), rule({ sourceQuestionId: 'q2', operator: 'greater_than', value: 50 })],
      'any'
    );
    expect(evaluateConditions(oneFailsOnePasses, answers)).toBe(true);
    expect(evaluateConditions(allFail, answers)).toBe(false);
  });
});

describe('isQuestionVisible / getVisibleQuestions', () => {
  it('a question with no conditional logic is always visible', () => {
    expect(isQuestionVisible({}, {})).toBe(true);
    expect(isQuestionVisible({ conditionalLogic: null }, {})).toBe(true);
    expect(isQuestionVisible({ conditionalLogic: config([]) }, {})).toBe(true);
  });

  it('a gated question becomes visible only when its rule passes', () => {
    const q = { conditionalLogic: config([rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'yes' })]) };
    expect(isQuestionVisible(q, { q1: 'no' })).toBe(false);
    expect(isQuestionVisible(q, { q1: 'yes' })).toBe(true);
  });

  it('filters the list and preserves the original order', () => {
    const questions = [
      { id: 'a' },
      { id: 'b', conditionalLogic: config([rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'yes' })]) },
      { id: 'c' },
    ];
    expect(getVisibleQuestions(questions, { q1: 'no' }).map((q) => q.id)).toEqual(['a', 'c']);
    expect(getVisibleQuestions(questions, { q1: 'yes' }).map((q) => q.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('validateConditionalLogic', () => {
  it('returns no errors for valid backward references', () => {
    const questions = [
      { id: 'q1', conditionalLogic: null },
      { id: 'q2', conditionalLogic: config([rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'yes' })]) },
    ];
    expect(validateConditionalLogic(questions)).toEqual([]);
  });

  it('flags a rule that references a nonexistent question', () => {
    const questions = [
      { id: 'q1', conditionalLogic: config([rule({ sourceQuestionId: 'ghost', operator: 'equals', value: 'x' })]) },
    ];
    const errors = validateConditionalLogic(questions);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ questionId: 'q1', ruleIndex: 0 });
    expect(errors[0].message).toMatch(/no longer exists/i);
  });

  it('flags a self-reference', () => {
    const questions = [
      { id: 'q1', conditionalLogic: config([rule({ sourceQuestionId: 'q1', operator: 'equals', value: 'x' })]) },
    ];
    const errors = validateConditionalLogic(questions);
    expect(errors.some((e) => /reference itself/i.test(e.message))).toBe(true);
  });

  it('flags a forward reference (a question may only depend on earlier ones)', () => {
    const questions = [
      { id: 'q1', conditionalLogic: config([rule({ sourceQuestionId: 'q2', operator: 'equals', value: 'x' })]) },
      { id: 'q2', conditionalLogic: null },
    ];
    const errors = validateConditionalLogic(questions);
    expect(errors.some((e) => /appear before/i.test(e.message))).toBe(true);
  });
});

describe('operator metadata helpers', () => {
  it('getOperatorsForType returns type-specific operators, falling back to the common pair', () => {
    expect(getOperatorsForType('number')).toEqual(
      expect.arrayContaining(['greater_than', 'less_than', 'is_empty', 'is_not_empty'])
    );
    expect(getOperatorsForType('radio')).toEqual(expect.arrayContaining(['equals', 'not_equals']));
    expect(getOperatorsForType('radio')).not.toContain('greater_than');
    // unknown type → just the common operators
    expect(getOperatorsForType('mystery')).toEqual(['is_empty', 'is_not_empty']);
  });

  it('getOperatorLabel returns a human-readable label', () => {
    expect(getOperatorLabel('equals')).toBe('is equal to');
    expect(getOperatorLabel('greater_than')).toBe('is greater than');
    expect(getOperatorLabel('is_empty')).toBe('is empty');
  });

  it('operatorRequiresValue is false only for the empty checks', () => {
    expect(operatorRequiresValue('equals')).toBe(true);
    expect(operatorRequiresValue('greater_than')).toBe(true);
    expect(operatorRequiresValue('is_empty')).toBe(false);
    expect(operatorRequiresValue('is_not_empty')).toBe(false);
  });
});
