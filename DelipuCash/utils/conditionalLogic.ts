/**
 * Conditional Logic Engine — Pure Functions for Survey Branching
 *
 * Evaluates conditional display rules to show/hide questions based on answers.
 * Used by both the survey builder (preview) and respondent survey screen.
 *
 * No React dependencies — fully testable.
 */

import type { ConditionalLogicConfig, ConditionalRule, BuilderQuestionData } from '@/store/SurveyBuilderStore';

// ============================================================================
// TYPES
// ============================================================================

/** Answer values from the survey attempt store */
export type AnswerMap = Record<string, string | number | boolean | string[] | null | undefined>;

export interface ValidationError {
  questionId: string;
  ruleIndex: number;
  message: string;
}

// ============================================================================
// SINGLE RULE EVALUATION
// ============================================================================

/**
 * Evaluate a single conditional rule against the current answers.
 */
export function evaluateCondition(rule: ConditionalRule, answers: AnswerMap): boolean {
  const answer = answers[rule.sourceQuestionId];

  switch (rule.operator) {
    case 'is_empty':
      return answer == null || answer === '' || (Array.isArray(answer) && answer.length === 0);

    case 'is_not_empty':
      return answer != null && answer !== '' && !(Array.isArray(answer) && answer.length === 0);

    case 'equals': {
      if (Array.isArray(answer)) {
        // For checkbox (multi-select), check if the value is included
        return answer.includes(String(rule.value));
      }
      return String(answer) === String(rule.value);
    }

    case 'not_equals': {
      if (Array.isArray(answer)) {
        return !answer.includes(String(rule.value));
      }
      return String(answer) !== String(rule.value);
    }

    case 'contains': {
      const answerStr = Array.isArray(answer) ? answer.join(',') : String(answer ?? '');
      return answerStr.toLowerCase().includes(String(rule.value).toLowerCase());
    }

    case 'greater_than': {
      const numAnswer = Number(answer);
      const numValue = Number(rule.value);
      if (isNaN(numAnswer) || isNaN(numValue)) return false;
      return numAnswer > numValue;
    }

    case 'less_than': {
      const numAnswer = Number(answer);
      const numValue = Number(rule.value);
      if (isNaN(numAnswer) || isNaN(numValue)) return false;
      return numAnswer < numValue;
    }

    default:
      return true; // Unknown operator — default to visible
  }
}

// ============================================================================
// MULTI-RULE EVALUATION
// ============================================================================

/**
 * Evaluate all rules in a conditional logic config using AND/OR logic.
 * Returns true if the question should be SHOWN.
 */
export function evaluateConditions(
  config: ConditionalLogicConfig,
  answers: AnswerMap
): boolean {
  if (!config.rules || config.rules.length === 0) return true;

  if (config.logicType === 'all') {
    // AND: all rules must be true
    return config.rules.every((rule) => evaluateCondition(rule, answers));
  } else {
    // OR: at least one rule must be true
    return config.rules.some((rule) => evaluateCondition(rule, answers));
  }
}

// ============================================================================
// QUESTION VISIBILITY
// ============================================================================

/**
 * Check if a single question should be visible given current answers.
 * Questions without conditional logic are always visible.
 */
export function isQuestionVisible(
  question: { conditionalLogic?: ConditionalLogicConfig | null },
  answers: AnswerMap
): boolean {
  if (!question.conditionalLogic || question.conditionalLogic.rules.length === 0) {
    return true;
  }
  return evaluateConditions(question.conditionalLogic, answers);
}

/**
 * Filter all questions to only those visible given current answers.
 * Maintains the original order.
 */
export function getVisibleQuestions<T extends { conditionalLogic?: ConditionalLogicConfig | null }>(
  allQuestions: T[],
  answers: AnswerMap
): T[] {
  return allQuestions.filter((q) => isQuestionVisible(q, answers));
}

// ============================================================================
// AVAILABLE OPERATORS PER QUESTION TYPE
// ============================================================================

type OperatorType = ConditionalRule['operator'];

const COMMON_OPERATORS: OperatorType[] = ['is_empty', 'is_not_empty'];

const OPERATORS_BY_TYPE: Record<string, OperatorType[]> = {
  text: ['equals', 'not_equals', 'contains', ...COMMON_OPERATORS],
  paragraph: ['equals', 'not_equals', 'contains', ...COMMON_OPERATORS],
  radio: ['equals', 'not_equals', ...COMMON_OPERATORS],
  checkbox: ['equals', 'not_equals', 'contains', ...COMMON_OPERATORS],
  dropdown: ['equals', 'not_equals', ...COMMON_OPERATORS],
  rating: ['equals', 'not_equals', 'greater_than', 'less_than', ...COMMON_OPERATORS],
  number: ['equals', 'not_equals', 'greater_than', 'less_than', ...COMMON_OPERATORS],
  boolean: ['equals', 'not_equals', ...COMMON_OPERATORS],
  date: ['equals', 'not_equals', ...COMMON_OPERATORS],
  time: ['equals', 'not_equals', ...COMMON_OPERATORS],
  file_upload: [...COMMON_OPERATORS],
};

/**
 * Get the available comparison operators for a given question type.
 */
export function getOperatorsForType(questionType: string): OperatorType[] {
  return OPERATORS_BY_TYPE[questionType] || COMMON_OPERATORS;
}

/**
 * Human-readable label for an operator.
 */
export function getOperatorLabel(operator: OperatorType): string {
  const labels: Record<OperatorType, string> = {
    equals: 'is equal to',
    not_equals: 'is not equal to',
    contains: 'contains',
    greater_than: 'is greater than',
    less_than: 'is less than',
    is_empty: 'is empty',
    is_not_empty: 'is not empty',
  };
  return labels[operator] || operator;
}

/**
 * Whether an operator requires a value input (is_empty/is_not_empty do not).
 */
export function operatorRequiresValue(operator: OperatorType): boolean {
  return operator !== 'is_empty' && operator !== 'is_not_empty';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate all conditional logic rules across all questions.
 * Catches circular dependencies, references to nonexistent or later questions, etc.
 */
export function validateConditionalLogic(
  questions: Pick<BuilderQuestionData, 'id' | 'conditionalLogic'>[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const questionIds = new Set(questions.map((q) => q.id));
  const questionOrder = new Map(questions.map((q, i) => [q.id, i]));

  for (const question of questions) {
    if (!question.conditionalLogic?.rules) continue;

    for (let i = 0; i < question.conditionalLogic.rules.length; i++) {
      const rule = question.conditionalLogic.rules[i];

      // Rule references a nonexistent question
      if (!questionIds.has(rule.sourceQuestionId)) {
        errors.push({
          questionId: question.id,
          ruleIndex: i,
          message: `Rule references a question that no longer exists`,
        });
        continue;
      }

      // Self-reference
      if (rule.sourceQuestionId === question.id) {
        errors.push({
          questionId: question.id,
          ruleIndex: i,
          message: `Question cannot reference itself in conditional logic`,
        });
        continue;
      }

      // Reference to a later question (branching should only look backward)
      const sourceOrder = questionOrder.get(rule.sourceQuestionId) ?? -1;
      const targetOrder = questionOrder.get(question.id) ?? -1;
      if (sourceOrder >= targetOrder) {
        errors.push({
          questionId: question.id,
          ruleIndex: i,
          message: `Conditional logic can only reference questions that appear before this one`,
        });
      }
    }
  }

  // Check for circular dependencies (A depends on B, B depends on A)
  // Since we enforce "only reference previous questions" above, circular deps
  // are structurally impossible. But we add a safety check anyway.
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function hasCycle(qId: string): boolean {
    if (visiting.has(qId)) return true;
    if (visited.has(qId)) return false;

    visiting.add(qId);
    const q = questions.find((qq) => qq.id === qId);
    if (q?.conditionalLogic?.rules) {
      for (const rule of q.conditionalLogic.rules) {
        if (hasCycle(rule.sourceQuestionId)) {
          errors.push({
            questionId: qId,
            ruleIndex: 0,
            message: `Circular dependency detected in conditional logic`,
          });
          visiting.delete(qId);
          return true;
        }
      }
    }
    visiting.delete(qId);
    visited.add(qId);
    return false;
  }

  for (const q of questions) {
    if (q.conditionalLogic?.rules?.length) {
      hasCycle(q.id);
    }
  }

  return errors;
}
