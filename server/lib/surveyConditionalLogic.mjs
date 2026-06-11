/**
 * Server-side validation for survey conditional logic.
 *
 * ESM port of the pure validation half of the client's
 * DelipuCash/utils/conditionalLogic.ts (the client is TypeScript and can't be
 * imported by the .mjs server). The rule SHAPE matches the evaluator already
 * embedded in submitSurveyResponse:
 *   { logicType: 'all'|'any', rules: [{ sourceQuestionId, operator, value? }] }
 *
 * Catches: references to nonexistent questions, self-references, forward
 * references (branching may only look backward), circular dependencies, and
 * malformed rule objects. Returns an array of { questionIndex, ruleIndex,
 * message } — empty means valid.
 */

const VALID_OPERATORS = new Set([
  'equals',
  'not_equals',
  'contains',
  'greater_than',
  'less_than',
  'is_empty',
  'is_not_empty',
]);

const VALID_LOGIC_TYPES = new Set(['all', 'any']);

/**
 * @param {Array<{ id: string, conditionalLogic?: { logicType?: string, rules?: Array<{ sourceQuestionId?: string, operator?: string }> } | null }>} questions
 *   Questions in display order. `id` is whatever id-space the rules reference
 *   (builder clientIds before remap, DB UUIDs after).
 */
export function validateConditionalLogic(questions) {
  const errors = [];
  const questionIds = new Set(questions.map((q) => q.id));
  const questionOrder = new Map(questions.map((q, i) => [q.id, i]));

  questions.forEach((question, questionIndex) => {
    const logic = question.conditionalLogic;
    if (logic == null) return;

    if (typeof logic !== 'object' || Array.isArray(logic) || !Array.isArray(logic.rules)) {
      errors.push({ questionIndex, ruleIndex: -1, message: 'conditionalLogic must be { logicType, rules[] }' });
      return;
    }
    if (logic.rules.length === 0) return;

    if (logic.logicType !== undefined && !VALID_LOGIC_TYPES.has(logic.logicType)) {
      errors.push({ questionIndex, ruleIndex: -1, message: `logicType must be 'all' or 'any'` });
    }

    logic.rules.forEach((rule, ruleIndex) => {
      if (!rule || typeof rule !== 'object' || typeof rule.sourceQuestionId !== 'string') {
        errors.push({ questionIndex, ruleIndex, message: 'Rule must have a sourceQuestionId' });
        return;
      }
      if (!VALID_OPERATORS.has(rule.operator)) {
        errors.push({ questionIndex, ruleIndex, message: `Unknown operator: ${String(rule.operator)}` });
        return;
      }
      if (!questionIds.has(rule.sourceQuestionId)) {
        errors.push({ questionIndex, ruleIndex, message: 'Rule references a question that does not exist' });
        return;
      }
      if (rule.sourceQuestionId === question.id) {
        errors.push({ questionIndex, ruleIndex, message: 'Question cannot reference itself in conditional logic' });
        return;
      }
      const sourceOrder = questionOrder.get(rule.sourceQuestionId) ?? -1;
      if (sourceOrder >= questionIndex) {
        errors.push({
          questionIndex,
          ruleIndex,
          message: 'Conditional logic can only reference questions that appear before this one',
        });
      }
    });
  });

  // Cycle check (structurally impossible once backward-only holds, kept as a
  // safety net — mirrors the client validator).
  const visited = new Set();
  const visiting = new Set();
  const byId = new Map(questions.map((q) => [q.id, q]));

  function hasCycle(qId, questionIndex) {
    if (visiting.has(qId)) return true;
    if (visited.has(qId)) return false;
    visiting.add(qId);
    const q = byId.get(qId);
    const rules = q?.conditionalLogic?.rules;
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        if (rule && typeof rule.sourceQuestionId === 'string' && byId.has(rule.sourceQuestionId)) {
          if (hasCycle(rule.sourceQuestionId, questionIndex)) {
            errors.push({ questionIndex, ruleIndex: 0, message: 'Circular dependency detected in conditional logic' });
            visiting.delete(qId);
            return true;
          }
        }
      }
    }
    visiting.delete(qId);
    visited.add(qId);
    return false;
  }

  questions.forEach((q, i) => {
    if (Array.isArray(q.conditionalLogic?.rules) && q.conditionalLogic.rules.length > 0) {
      hasCycle(q.id, i);
    }
  });

  return errors;
}

/**
 * Rewrite every rule's sourceQuestionId through an id map (builder clientId →
 * created DB UUID). Returns a NEW logic object; null/undefined pass through.
 * Throws on an unresolvable reference — callers validate first, so this firing
 * means a bug, and the surrounding transaction must roll back.
 */
export function remapConditionalLogicIds(logic, idMap) {
  if (logic == null) return logic;
  if (!Array.isArray(logic.rules)) return logic;
  return {
    ...logic,
    rules: logic.rules.map((rule) => {
      const mapped = idMap.get(rule.sourceQuestionId);
      if (!mapped) {
        throw new Error(`Unresolvable conditional-logic reference: ${String(rule.sourceQuestionId)}`);
      }
      return { ...rule, sourceQuestionId: mapped };
    }),
  };
}
