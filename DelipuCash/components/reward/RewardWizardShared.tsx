/**
 * Shared wizard primitives for instant & regular reward creation screens.
 * Follows the StepIndicator / Footer / animation patterns from CreateQuestionWizard.tsx.
 */

import React, { memo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Send,
} from "lucide-react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { triggerHaptic } from "@/utils/quiz-utils";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import type { LucideIcon } from "lucide-react-native";

// ============================================================================
// TYPES
// ============================================================================

export interface WizardStep {
  id: string;
  title: string;
  icon: LucideIcon;
}

// ============================================================================
// buildOptionsPayload — converts string[] → Record keyed A/B/C/D
// ============================================================================

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

/**
 * Converts an array of option strings into the `{A: "text", B: "text"}` format
 * expected by the backend, filtering out empty strings.
 */
export function buildOptionsPayload(options: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  options.forEach((text, i) => {
    const trimmed = text.trim();
    if (trimmed && i < OPTION_KEYS.length) {
      result[OPTION_KEYS[i]] = trimmed;
    }
  });
  return result;
}

/**
 * Given a 0-based option index, return the letter key (A/B/C/D).
 */
export function optionIndexToKey(index: number): string {
  return OPTION_KEYS[index] ?? "";
}

// ============================================================================
// WizardStepIndicator
// ============================================================================

export const WizardStepIndicator = memo(function WizardStepIndicator({
  steps,
  currentStep,
  onStepPress,
}: {
  steps: WizardStep[];
  currentStep: number;
  onStepPress: (step: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const StepIcon = step.icon;
        const canNavigate = index < currentStep;

        return (
          <Pressable
            key={step.id}
            onPress={() => {
              if (canNavigate) {
                triggerHaptic("selection");
                onStepPress(index);
              }
            }}
            disabled={!canNavigate}
            style={styles.stepItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Step ${index + 1}: ${step.title}${isCompleted ? ", completed" : ""}`}
          >
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor:
                    isActive || isCompleted
                      ? colors.primary
                      : withAlpha(colors.textMuted, 0.2),
                },
              ]}
            >
              {isCompleted ? (
                <Check size={14} color={colors.primaryText} strokeWidth={3} />
              ) : (
                <StepIcon
                  size={14}
                  color={isActive ? colors.primaryText : colors.textMuted}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                {
                  color: isActive ? colors.primary : colors.textMuted,
                  fontFamily: isActive
                    ? TYPOGRAPHY.fontFamily.bold
                    : TYPOGRAPHY.fontFamily.regular,
                },
              ]}
            >
              {step.title}
            </Text>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  {
                    backgroundColor: isCompleted
                      ? colors.primary
                      : withAlpha(colors.textMuted, 0.2),
                  },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

// ============================================================================
// WizardScreenHeader
// ============================================================================

export const WizardScreenHeader = memo(function WizardScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <Pressable
        style={[styles.iconButton, { backgroundColor: colors.secondary }]}
        onPress={() => {
          triggerHaptic("light");
          onBack();
        }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Returns to the previous screen"
        hitSlop={8}
      >
        <ArrowLeft size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
      <View style={{ width: COMPONENT_SIZE.touchTarget }} />
    </View>
  );
});

// ============================================================================
// WizardFooter
// ============================================================================

export const WizardFooter = memo(function WizardFooter({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isSubmitting,
  submitLabel = "Create Reward",
}: {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}) {
  const { colors } = useTheme();
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      {!isFirstStep ? (
        <Pressable
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => {
            triggerHaptic("light");
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Go to previous step"
        >
          <ChevronLeft size={16} color={colors.text} />
          <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
        </Pressable>
      ) : (
        <View />
      )}
      <View style={styles.footerSpacer} />
      <PrimaryButton
        title={isLastStep ? submitLabel : "Continue"}
        onPress={onNext}
        loading={isSubmitting}
        rightIcon={
          isLastStep ? (
            <Send size={16} color="#fff" strokeWidth={2} />
          ) : (
            <ChevronRight size={16} color="#fff" strokeWidth={2} />
          )
        }
        style={styles.nextButton}
        accessibilityLabel={isLastStep ? submitLabel : "Continue to next step"}
      />
    </View>
  );
});

// ============================================================================
// OptionInputGroup — 2×2 grid of option inputs
// ============================================================================

export const OptionInputGroup = memo(function OptionInputGroup({
  options,
  onChangeOption,
}: {
  options: [string, string, string, string];
  onChangeOption: (index: number, value: string) => void;
}) {
  const { colors } = useTheme();

  const labels = ["Option A *", "Option B *", "Option C", "Option D"];
  const placeholders = [
    "First option",
    "Second option",
    "Third option (optional)",
    "Fourth option (optional)",
  ];

  return (
    <>
      <View style={styles.formRow}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.formGroup,
              { flex: 1, marginRight: i === 0 ? SPACING.xs : 0, marginLeft: i === 1 ? SPACING.xs : 0 },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>{labels[i]}</Text>
            <TextInput
              style={[
                styles.uploadInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder={placeholders[i]}
              placeholderTextColor={colors.textMuted}
              value={options[i]}
              onChangeText={(v) => onChangeOption(i, v)}
              accessibilityLabel={`Answer option ${OPTION_KEYS[i]}`}
            />
          </View>
        ))}
      </View>
      <View style={styles.formRow}>
        {[2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.formGroup,
              { flex: 1, marginRight: i === 2 ? SPACING.xs : 0, marginLeft: i === 3 ? SPACING.xs : 0 },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>{labels[i]}</Text>
            <TextInput
              style={[
                styles.uploadInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder={placeholders[i]}
              placeholderTextColor={colors.textMuted}
              value={options[i]}
              onChangeText={(v) => onChangeOption(i, v)}
              accessibilityLabel={`Answer option ${OPTION_KEYS[i]}`}
            />
          </View>
        ))}
      </View>
    </>
  );
});

// ============================================================================
// CorrectAnswerSelector — radio group for A/B/C/D
// ============================================================================

export const CorrectAnswerSelector = memo(function CorrectAnswerSelector({
  options,
  selectedIndex,
  onSelect,
}: {
  /** The 4 option texts (empty string = unfilled) */
  options: [string, string, string, string];
  /** Currently selected index (0-3) or -1 for none */
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { colors } = useTheme();

  // Only show options that have text
  const filledOptions = options
    .map((text, i) => ({ text: text.trim(), index: i, key: OPTION_KEYS[i] }))
    .filter((o) => o.text.length > 0);

  if (filledOptions.length === 0) {
    return (
      <Text style={[styles.hintText, { color: colors.textMuted }]}>
        Fill in at least 2 options above to select the correct answer.
      </Text>
    );
  }

  return (
    <View style={styles.correctAnswerGroup}>
      {filledOptions.map((opt) => {
        const isSelected = opt.index === selectedIndex;
        return (
          <Pressable
            key={opt.key}
            style={[
              styles.correctAnswerOption,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected
                  ? withAlpha(colors.primary, 0.1)
                  : colors.card,
              },
            ]}
            onPress={() => {
              triggerHaptic("selection");
              onSelect(opt.index);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Option ${opt.key}: ${opt.text}`}
          >
            <View
              style={[
                styles.radioOuter,
                { borderColor: isSelected ? colors.primary : colors.border },
              ]}
            >
              {isSelected && (
                <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
              )}
            </View>
            <Text
              style={[
                styles.correctAnswerKey,
                { color: isSelected ? colors.primary : colors.textMuted },
              ]}
            >
              {opt.key}.
            </Text>
            <Text
              style={[
                styles.correctAnswerText,
                { color: isSelected ? colors.text : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {opt.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// ============================================================================
// RewardAmountInput — UGX ↔ Points bidirectional sync
// ============================================================================

export const RewardAmountInput = memo(function RewardAmountInput({
  rewardAmount,
  rewardPoints,
  onAmountChange,
  onPointsChange,
  conversionHint,
}: {
  rewardAmount: string;
  rewardPoints: string;
  onAmountChange: (text: string) => void;
  onPointsChange: (text: string) => void;
  conversionHint: string;
}) {
  const { colors } = useTheme();

  return (
    <>
      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.xs }]}>
          <Text style={[styles.label, { color: colors.text }]}>Reward (UGX) *</Text>
          <TextInput
            style={[
              styles.uploadInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={rewardAmount}
            onChangeText={onAmountChange}
            keyboardType="numeric"
            accessibilityLabel="Reward amount in UGX"
          />
        </View>
        <View style={styles.syncIconContainer}>
          <RefreshCw size={14} color={colors.textMuted} />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
          <Text style={[styles.label, { color: colors.text }]}>Points</Text>
          <TextInput
            style={[
              styles.uploadInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={rewardPoints}
            onChangeText={onPointsChange}
            keyboardType="numeric"
            accessibilityLabel="Reward amount in points"
          />
        </View>
      </View>
      <Text style={[styles.conversionHint, { color: colors.textMuted }]}>
        {conversionHint}
      </Text>
    </>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginLeft: SPACING.xs,
  },
  stepConnector: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginHorizontal: SPACING.xs,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
    textAlign: "center",
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minHeight: COMPONENT_SIZE.button.medium,
  },
  backButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  footerSpacer: {
    flex: 1,
  },
  nextButton: {
    minWidth: 140,
  },

  // Form shared
  formGroup: {
    marginBottom: SPACING.md,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  uploadInput: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.medium,
  },
  multilineInput: {
    minHeight: COMPONENT_SIZE.input.medium * 2,
    paddingTop: SPACING.md,
  },
  hintText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: "italic",
  },

  // Correct answer selector
  correctAnswerGroup: {
    gap: SPACING.sm,
  },
  correctAnswerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  correctAnswerKey: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    width: 20,
  },
  correctAnswerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },

  // Reward amount sync
  syncIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: SPACING.lg,
    width: 24,
  },
  conversionHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.md,
  },
});

// ============================================================================
// ReviewRow — shared helper for the review step
// ============================================================================

export const ReviewRow = memo(function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={reviewStyles.reviewRow}>
      <Text style={[reviewStyles.reviewRowLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[reviewStyles.reviewRowValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
});

// ============================================================================
// Review styles — shared between instant & regular upload screens
// ============================================================================

export const reviewStyles = StyleSheet.create({
  reviewCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.base,
    marginBottom: SPACING.md,
  },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  reviewCardTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reviewText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  reviewOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  reviewOptionKey: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    width: 20,
  },
  reviewOptionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    flex: 1,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  reviewRowLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  reviewRowValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
