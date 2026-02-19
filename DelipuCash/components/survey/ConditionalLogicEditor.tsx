/**
 * ConditionalLogicEditor — Per-question condition configuration modal
 *
 * Allows survey creators to set display conditions on questions:
 * "Show this question if [Question X] [operator] [value]"
 *
 * Features:
 * - Source question picker (only preceding questions)
 * - Dynamic operator list based on source question type
 * - Value input (text, option picker, numeric depending on type)
 * - Multiple rules with AND/OR toggle
 * - Validation with error display
 * - Accessible: roles, labels, focus management
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Plus,
  Trash2,
  X,
  GitBranch,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, SHADOWS, withAlpha } from '@/utils/theme';
import type {
  ConditionalLogicConfig,
  ConditionalRule,
  BuilderQuestionData,
} from '@/store/SurveyBuilderStore';
import {
  getOperatorsForType,
  getOperatorLabel,
  operatorRequiresValue,
  validateConditionalLogic,
} from '@/utils/conditionalLogic';

// ============================================================================
// TYPES
// ============================================================================

interface ConditionalLogicEditorProps {
  /** The question being configured */
  question: BuilderQuestionData;
  /** All questions in the survey (needed to populate source pickers) */
  allQuestions: BuilderQuestionData[];
  /** Current config (or null) */
  config: ConditionalLogicConfig | null;
  /** Callback when config changes */
  onSave: (config: ConditionalLogicConfig | null) => void;
  /** Close the editor */
  onClose: () => void;
  /** Whether the modal is visible */
  visible: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ConditionalLogicEditor: React.FC<ConditionalLogicEditorProps> = ({
  question,
  allQuestions,
  config,
  onSave,
  onClose,
  visible,
}) => {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // Local editing state
  const [rules, setRules] = useState<ConditionalRule[]>(config?.rules || []);
  const [logicType, setLogicType] = useState<'all' | 'any'>(config?.logicType || 'all');
  const [showSourcePicker, setShowSourcePicker] = useState<number | null>(null);
  const [showOperatorPicker, setShowOperatorPicker] = useState<number | null>(null);

  // Only questions that come BEFORE this question can be sources
  const availableSources = useMemo(() => {
    const currentIdx = allQuestions.findIndex((q) => q.id === question.id);
    return allQuestions.slice(0, currentIdx).filter((q) => q.text.trim());
  }, [allQuestions, question.id]);

  // Validation
  const validationErrors = useMemo(() => {
    if (rules.length === 0) return [];
    return validateConditionalLogic([
      { ...question, conditionalLogic: { rules, logicType } },
    ]);
  }, [rules, logicType, question]);

  const addRule = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const firstSource = availableSources[0];
    if (!firstSource) return;
    setRules((prev) => [
      ...prev,
      {
        sourceQuestionId: firstSource.id,
        operator: 'equals',
        value: '',
        action: 'show',
      },
    ]);
    // Scroll to the newly added rule after render
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [availableSources]);

  const removeRule = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRules((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRule = useCallback((index: number, updates: Partial<ConditionalRule>) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  }, []);

  const handleSave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (rules.length === 0) {
      onSave(null); // Remove conditional logic
    } else {
      onSave({ rules, logicType });
    }
    onClose();
  }, [rules, logicType, onSave, onClose]);

  const handleClear = useCallback(() => {
    setRules([]);
    onSave(null);
    onClose();
  }, [onSave, onClose]);

  const getSourceQuestion = (sourceId: string) =>
    allQuestions.find((q) => q.id === sourceId);

  const getSourceOptions = (sourceId: string): string[] => {
    const source = getSourceQuestion(sourceId);
    if (!source) return [];
    // For radio/checkbox/dropdown, use their options
    if (['radio', 'checkbox', 'dropdown'].includes(source.type)) {
      return source.options;
    }
    // For boolean
    if (source.type === 'boolean') {
      return [source.options[0] || 'Yes', source.options[1] || 'No'];
    }
    return [];
  };

  const renderRuleEditor = (rule: ConditionalRule, index: number) => {
    const sourceQuestion = getSourceQuestion(rule.sourceQuestionId);
    const operators = sourceQuestion ? getOperatorsForType(sourceQuestion.type) : [];
    const sourceOptions = getSourceOptions(rule.sourceQuestionId);
    const needsValue = operatorRequiresValue(rule.operator);

    return (
      <View
        key={index}
        style={[styles.ruleCard, { backgroundColor: colors.background, borderColor: withAlpha(colors.border, 0.5) }]}
        accessibilityRole="group"
        accessibilityLabel={`Rule ${index + 1}`}
      >
        {/* Rule header with delete */}
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleLabel, { color: colors.textMuted }]}>
            {index > 0 ? (logicType === 'all' ? 'AND' : 'OR') : 'IF'}
          </Text>
          <TouchableOpacity
            onPress={() => removeRule(index)}
            style={styles.deleteRuleBtn}
            accessibilityRole="button"
            accessibilityLabel={`Remove rule ${index + 1}`}
          >
            <Trash2 size={14} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Source question picker */}
        <TouchableOpacity
          style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => setShowSourcePicker(showSourcePicker === index ? null : index)}
          accessibilityRole="button"
          accessibilityLabel="Select source question"
        >
          <Text style={[styles.pickerText, { color: sourceQuestion ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {sourceQuestion ? sourceQuestion.text : 'Select a question...'}
          </Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Source picker dropdown */}
        {showSourcePicker === index && (
          <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.md]}>
            {availableSources.map((src) => (
              <TouchableOpacity
                key={src.id}
                style={[styles.dropdownItem, rule.sourceQuestionId === src.id && { backgroundColor: withAlpha(colors.primary, 0.08) }]}
                onPress={() => {
                  updateRule(index, { sourceQuestionId: src.id, value: '' });
                  setShowSourcePicker(null);
                }}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]} numberOfLines={1}>
                  {src.text}
                </Text>
                {rule.sourceQuestionId === src.id && <Check size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Operator picker */}
        <TouchableOpacity
          style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card, marginTop: SPACING.xs }]}
          onPress={() => setShowOperatorPicker(showOperatorPicker === index ? null : index)}
          accessibilityRole="button"
          accessibilityLabel="Select comparison operator"
        >
          <Text style={[styles.pickerText, { color: colors.text }]}>
            {getOperatorLabel(rule.operator)}
          </Text>
          <ChevronDown size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Operator dropdown */}
        {showOperatorPicker === index && (
          <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.md]}>
            {operators.map((op) => (
              <TouchableOpacity
                key={op}
                style={[styles.dropdownItem, rule.operator === op && { backgroundColor: withAlpha(colors.primary, 0.08) }]}
                onPress={() => {
                  updateRule(index, { operator: op });
                  setShowOperatorPicker(null);
                }}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {getOperatorLabel(op)}
                </Text>
                {rule.operator === op && <Check size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Value input (if operator requires it) */}
        {needsValue && (
          <View style={{ marginTop: SPACING.xs }}>
            {sourceOptions.length > 0 ? (
              // Option-based value picker
              <View style={styles.optionChips}>
                {sourceOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: String(rule.value) === opt ? colors.primary : colors.background,
                        borderColor: String(rule.value) === opt ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => updateRule(index, { value: opt })}
                  >
                    <Text style={[styles.optionChipText, { color: String(rule.value) === opt ? colors.primaryText : colors.text }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // Free-text/numeric value input
              <TextInput
                value={String(rule.value ?? '')}
                onChangeText={(text) => updateRule(index, { value: text })}
                placeholder="Enter value..."
                placeholderTextColor={colors.textMuted}
                style={[styles.valueInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                keyboardType={sourceQuestion?.type === 'number' || sourceQuestion?.type === 'rating' ? 'numeric' : 'default'}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: withAlpha(colors.border, 0.3) }]}>
            <View style={styles.headerLeft}>
              <GitBranch size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Conditional Logic</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Target question */}
          <View style={[styles.targetBanner, { backgroundColor: withAlpha(colors.primary, 0.06) }]}>
            <Text style={[styles.targetLabel, { color: colors.textMuted }]}>Show this question:</Text>
            <Text style={[styles.targetText, { color: colors.text }]} numberOfLines={2}>
              {question.text || 'Untitled Question'}
            </Text>
          </View>

          <ScrollView ref={scrollViewRef} style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Logic type toggle (AND/OR) */}
            {rules.length > 1 && (
              <View style={styles.logicToggle}>
                <Text style={[styles.logicLabel, { color: colors.textMuted }]}>Match:</Text>
                {(['all', 'any'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.logicButton,
                      {
                        backgroundColor: logicType === type ? colors.primary : colors.background,
                        borderColor: logicType === type ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setLogicType(type)}
                  >
                    <Text style={[styles.logicButtonText, { color: logicType === type ? colors.primaryText : colors.text }]}>
                      {type === 'all' ? 'All rules (AND)' : 'Any rule (OR)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Rules */}
            {rules.map((rule, idx) => renderRuleEditor(rule, idx))}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <View style={[styles.errorBanner, { backgroundColor: withAlpha(colors.error, 0.08) }]}>
                {validationErrors.map((err, i) => (
                  <Text key={i} style={[styles.errorText, { color: colors.error }]}>
                    {err.message}
                  </Text>
                ))}
              </View>
            )}

            {/* No sources available warning */}
            {availableSources.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: withAlpha(colors.warning, 0.08) }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Add questions before this one to use conditional logic.
                  Conditions can only reference preceding questions.
                </Text>
              </View>
            )}

            {/* Add rule button */}
            {availableSources.length > 0 && (
              <TouchableOpacity
                style={[styles.addRuleBtn, { borderColor: withAlpha(colors.primary, 0.3) }]}
                onPress={addRule}
                accessibilityRole="button"
                accessibilityLabel="Add condition rule"
              >
                <Plus size={16} color={colors.primary} />
                <Text style={[styles.addRuleText, { color: colors.primary }]}>Add Condition</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer actions */}
          <View style={[styles.footer, { borderTopColor: withAlpha(colors.border, 0.3) }]}>
            {rules.length > 0 && (
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: colors.border }]}
                onPress={handleClear}
                accessibilityRole="button"
                accessibilityLabel="Remove all conditions"
              >
                <Text style={[styles.clearText, { color: colors.error }]}>Remove Logic</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={validationErrors.length > 0}
              accessibilityRole="button"
              accessibilityLabel="Save conditional logic"
            >
              <Text style={[styles.saveText, { color: colors.primaryText }]}>
                {rules.length > 0 ? 'Save Logic' : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '85%',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '700',
  },
  targetBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.base,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  targetLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  targetText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  logicToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  logicLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '500',
  },
  logicButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  logicButtonText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '600',
  },
  ruleCard: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  ruleLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deleteRuleBtn: {
    padding: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    minHeight: 40,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
    marginRight: SPACING.xs,
  },
  dropdown: {
    marginTop: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    maxHeight: 160,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
  },
  dropdownText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  optionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  optionChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  optionChipText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: '500',
  },
  valueInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minHeight: 40,
  },
  errorBanner: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  emptyState: {
    padding: SPACING.base,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addRuleText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
    borderTopWidth: 1,
  },
  clearBtn: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  clearText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xs + 4,
    borderRadius: RADIUS.sm,
  },
  saveText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
  },
});

export default ConditionalLogicEditor;
