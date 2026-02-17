/**
 * CreateQuestionWizard Component
 * 
 * Multi-step modal wizard for creating questions, inspired by:
 * - Quora: Simple question input with topic selection
 * - Stack Overflow: Title + body + tags + preview
 * - Brainly: Quick question with fast answers
 * - JustAnswer: Expert selection + urgency settings
 * 
 * Features:
 * - Step-by-step wizard flow with progress indicator
 * - Question title with character counter
 * - Rich body input with markdown support hints
 * - Category/tag selection with AI suggestions
 * - Preview before submission
 * - Real-time validation
 * - Full accessibility support
 * 
 * @example
 * ```tsx
 * <CreateQuestionWizard
 *   visible={showWizard}
 *   onClose={() => setShowWizard(false)}
 *   onSubmit={handleSubmitQuestion}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  AccessibilityInfo,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  HelpCircle,
  Tag,
  AlertCircle,
  Sparkles,
  Eye,
  Send,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  COMPONENT_SIZE,
  withAlpha,
} from "@/utils/theme";
import { PrimaryButton } from "@/components/PrimaryButton";
import * as Haptics from "expo-haptics";

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionFormData {
  title: string;
  body: string;
  category: string;
  tags: string[];
  isRewardQuestion: boolean;
  rewardAmount: number;
  maxWinners: number;
  expiryHours: number;
}

export interface CreateQuestionWizardProps {
  /** Modal visibility */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Submit handler with form data */
  onSubmit: (data: QuestionFormData) => Promise<void>;
  /** Available categories */
  categories?: string[];
  /** Suggested tags based on content */
  suggestedTags?: string[];
  /** Loading state */
  isSubmitting?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS = [
  { id: "question", title: "Question", icon: HelpCircle },
  { id: "details", title: "Details", icon: Tag },
  { id: "preview", title: "Preview", icon: Eye },
];

const DEFAULT_CATEGORIES = [
  "Technology",
  "Business",
  "Finance",
  "Health",
  "Education",
  "Science",
  "Lifestyle",
  "Entertainment",
  "Sports",
  "General",
];

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 2000;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Step indicator component
 */
const StepIndicator = memo(function StepIndicator({
  steps,
  currentStep,
  onStepPress,
  colors,
}: {
  steps: typeof STEPS;
  currentStep: number;
  onStepPress: (step: number) => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
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
            onPress={() => canNavigate && onStepPress(index)}
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
                  backgroundColor: isActive || isCompleted 
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

/**
 * Category/tag chip component
 */
const Chip = memo(function Chip({
  label,
  isSelected,
  onPress,
  colors,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: isSelected 
            ? colors.primary 
            : withAlpha(colors.textMuted, 0.1),
          borderColor: isSelected 
            ? colors.primary 
            : withAlpha(colors.textMuted, 0.3),
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.chipText,
          {
            color: isSelected ? colors.primaryText : colors.text,
          },
        ]}
      >
        {label}
      </Text>
      {isSelected && (
        <Check size={12} color={colors.primaryText} strokeWidth={3} />
      )}
    </Pressable>
  );
});

/**
 * Input field with character counter
 */
const InputField = memo(function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  maxLength,
  hint,
  error,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
  error?: string;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const charCount = value.length;
  const hasError = !!error;
  const isNearLimit = maxLength && charCount > maxLength * 0.9;

  return (
    <View style={styles.inputFieldContainer}>
      <View style={styles.inputFieldHeader}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>
          {label}
        </Text>
        {maxLength && (
          <Text
            style={[
              styles.charCounter,
              {
                color: isNearLimit 
                  ? colors.warning 
                  : charCount >= maxLength 
                    ? colors.error 
                    : colors.textMuted,
              },
            ]}
          >
            {charCount}/{maxLength}
          </Text>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: hasError 
              ? colors.error 
              : isNearLimit 
                ? colors.warning 
                : colors.border,
          },
        ]}
        accessibilityLabel={label}
        accessibilityHint={hint}
      />
      {hint && !error && (
        <Text style={[styles.inputHint, { color: colors.textMuted }]}>
          {hint}
        </Text>
      )}
      {error && (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
});

// ============================================================================
// STEP CONTENT COMPONENTS
// ============================================================================

/**
 * Step 1: Question input
 */
const QuestionStep = memo(function QuestionStep({
  formData,
  updateFormData,
  errors,
  colors,
}: {
  formData: QuestionFormData;
  updateFormData: (updates: Partial<QuestionFormData>) => void;
  errors: Record<string, string>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Animated.View 
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      style={styles.stepContent}
    >
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        What&apos;s your question?
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Write a clear, specific question to get the best answers from the community.
      </Text>

      <InputField
        label="Question Title"
        value={formData.title}
        onChangeText={(text) => updateFormData({ title: text })}
        placeholder="e.g., How do I improve my productivity while working from home?"
        maxLength={MAX_TITLE_LENGTH}
        error={errors.title}
        hint="Be specific and concise"
        colors={colors}
      />

      <InputField
        label="Details (Optional)"
        value={formData.body}
        onChangeText={(text) => updateFormData({ body: text })}
        placeholder="Add more context or details to help others understand your question better..."
        multiline
        maxLength={MAX_BODY_LENGTH}
        error={errors.body}
        hint="Provide background information or what you've already tried"
        colors={colors}
      />

      {/* Writing tips */}
      <View 
        style={[
          styles.tipsContainer,
          { backgroundColor: withAlpha(colors.info, 0.1) },
        ]}
      >
        <Sparkles size={16} color={colors.info} />
        <View style={styles.tipsContent}>
          <Text style={[styles.tipsTitle, { color: colors.info }]}>
            Tips for great questions:
          </Text>
          <Text style={[styles.tipsText, { color: colors.textMuted }]}>
            • Be specific and clear{"\n"}
            • Explain what you&apos;ve tried{"\n"}
            • Use proper formatting
          </Text>
        </View>
      </View>
    </Animated.View>
  );
});

/**
 * Step 2: Category and tags
 */
const DetailsStep = memo(function DetailsStep({
  formData,
  updateFormData,
  categories,
  suggestedTags,
  errors,
  colors,
}: {
  formData: QuestionFormData;
  updateFormData: (updates: Partial<QuestionFormData>) => void;
  categories: string[];
  suggestedTags: string[];
  errors: Record<string, string>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const [customTag, setCustomTag] = useState("");

  const handleAddCustomTag = useCallback(() => {
    if (customTag.trim() && !formData.tags.includes(customTag.trim())) {
      updateFormData({ tags: [...formData.tags, customTag.trim()] });
      setCustomTag("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [customTag, formData.tags, updateFormData]);

  const handleToggleTag = useCallback((tag: string) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter(t => t !== tag)
      : [...formData.tags, tag];
    updateFormData({ tags: newTags });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [formData.tags, updateFormData]);

  return (
    <Animated.View
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      style={styles.stepContent}
    >
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Categorize your question
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Help others find and answer your question by adding the right category and tags.
      </Text>

      {/* Category selection */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Category *
        </Text>
        <View style={styles.chipsContainer}>
          {categories.map((category) => (
            <Chip
              key={category}
              label={category}
              isSelected={formData.category === category}
              onPress={() => {
                updateFormData({ category });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              colors={colors}
            />
          ))}
        </View>
        {errors.category && (
          <View style={styles.errorRow}>
            <AlertCircle size={12} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              {errors.category}
            </Text>
          </View>
        )}
      </View>

      {/* Tags */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionLabel, { color: colors.text }]}>
          Tags (Optional)
        </Text>
        <View style={styles.tagInputRow}>
          <TextInput
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="Add a tag..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.tagInput,
              {
                color: colors.text,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
            onSubmitEditing={handleAddCustomTag}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAddCustomTag}
            disabled={!customTag.trim()}
            style={[
              styles.addTagButton,
              { 
                backgroundColor: customTag.trim() 
                  ? colors.primary 
                  : withAlpha(colors.textMuted, 0.2),
              },
            ]}
          >
            <Tag size={16} color={customTag.trim() ? colors.primaryText : colors.textMuted} />
          </Pressable>
        </View>

        {/* Selected tags */}
        {formData.tags.length > 0 && (
          <View style={styles.selectedTagsContainer}>
            <Text style={[styles.selectedTagsLabel, { color: colors.textMuted }]}>
              Selected:
            </Text>
            <View style={styles.chipsContainer}>
              {formData.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  isSelected={true}
                  onPress={() => handleToggleTag(tag)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        )}

        {/* Suggested tags */}
        {suggestedTags.length > 0 && (
          <View style={styles.suggestedTagsContainer}>
            <View style={styles.suggestedTagsHeader}>
              <Sparkles size={14} color={colors.info} />
              <Text style={[styles.suggestedTagsLabel, { color: colors.info }]}>
                Suggested
              </Text>
            </View>
            <View style={styles.chipsContainer}>
              {suggestedTags.filter(t => !formData.tags.includes(t)).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  isSelected={false}
                  onPress={() => handleToggleTag(tag)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

/**
 * Step 4: Preview
 */
const PreviewStep = memo(function PreviewStep({
  formData,
  colors,
}: {
  formData: QuestionFormData;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  return (
    <Animated.View
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      style={styles.stepContent}
    >
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Preview your question
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Review everything before submitting. You can go back to make changes.
      </Text>

      {/* Preview card */}
      <View 
        style={[
          styles.previewCard,
          { backgroundColor: colors.card },
        ]}
      >
        {/* Badges row */}
        <View style={styles.previewBadges}>
          <View 
            style={[
              styles.previewCategoryBadge,
              { backgroundColor: withAlpha(colors.primary, 0.12) },
            ]}
          >
            <Text style={[styles.previewCategoryText, { color: colors.primary }]}>
              {formData.category || "Uncategorized"}
            </Text>
          </View>
        </View>

        {/* Question title */}
        <Text style={[styles.previewTitle, { color: colors.text }]}>
          {formData.title || "Your question title will appear here"}
        </Text>

        {/* Question body */}
        {formData.body && (
          <Text 
            style={[styles.previewBody, { color: colors.textMuted }]}
            numberOfLines={3}
          >
            {formData.body}
          </Text>
        )}

        {/* Tags */}
        {formData.tags.length > 0 && (
          <View style={styles.previewTags}>
            {formData.tags.map((tag) => (
              <View 
                key={tag}
                style={[
                  styles.previewTag,
                  { backgroundColor: withAlpha(colors.textMuted, 0.1) },
                ]}
              >
                <Text style={[styles.previewTagText, { color: colors.textMuted }]}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Reward details removed for simplified ask flow */}
      </View>
    </Animated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function CreateQuestionWizardComponent({
  visible,
  onClose,
  onSubmit,
  categories = DEFAULT_CATEGORIES,
  suggestedTags = [],
  isSubmitting = false,
}: CreateQuestionWizardProps): React.ReactElement | null {
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState<QuestionFormData>({
    title: "",
    body: "",
    category: "",
    tags: [],
    isRewardQuestion: false,
    rewardAmount: 0,
    maxWinners: 1,
    expiryHours: 24,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setErrors({});
      setFormData({
        title: "",
        body: "",
        category: "",
        tags: [],
        isRewardQuestion: false,
        rewardAmount: 0,
        maxWinners: 1,
        expiryHours: 24,
      });
    }
  }, [visible]);

  // Update form data helper
  const updateFormData = useCallback((updates: Partial<QuestionFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const errorKeys = Object.keys(updates);
    setErrors(prev => {
      const next = { ...prev };
      errorKeys.forEach(key => delete next[key]);
      return next;
    });
  }, []);

  // Validate current step
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Question step
        if (!formData.title.trim()) {
          newErrors.title = "Please enter your question";
        } else if (formData.title.trim().length < 10) {
          newErrors.title = "Question is too short (minimum 10 characters)";
        }
        break;

      case 1: // Details step
        if (!formData.category) {
          newErrors.category = "Please select a category";
        }
        break;
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    
    return true;
  }, [formData]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
      AccessibilityInfo.announceForAccessibility(`Step ${currentStep + 2} of ${STEPS.length}`);
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (validateStep(currentStep)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onSubmit(formData);
    }
  }, [currentStep, validateStep, formData, onSubmit]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  // Render step content
  const renderStepContent = useCallback(() => {
    switch (currentStep) {
      case 0:
        return (
          <QuestionStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
            colors={colors}
          />
        );
      case 1:
        return (
          <DetailsStep
            formData={formData}
            updateFormData={updateFormData}
            categories={categories}
            suggestedTags={suggestedTags}
            errors={errors}
            colors={colors}
          />
        );
      case 2:
        return (
          <PreviewStep
            formData={formData}
            colors={colors}
          />
        );
      default:
        return null;
    }
  }, [currentStep, formData, updateFormData, errors, colors, categories, suggestedTags]);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Ask a Question
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step indicator */}
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepPress={setCurrentStep}
          colors={colors}
        />

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {!isFirstStep && (
            <Pressable
              onPress={handleBack}
              style={[
                styles.backButton,
                { borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <ChevronLeft size={20} color={colors.text} />
              <Text style={[styles.backButtonText, { color: colors.text }]}>
                Back
              </Text>
            </Pressable>
          )}
          
          <View style={styles.footerSpacer} />
          
          <PrimaryButton
            title={isLastStep ? "Submit Question" : "Continue"}
            onPress={isLastStep ? handleSubmit : handleNext}
            loading={isSubmitting}
            rightIcon={isLastStep 
              ? <Send size={18} color={colors.primaryText} /> 
              : <ChevronRight size={18} color={colors.primaryText} />
            }
            style={styles.nextButton}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const CreateQuestionWizard = memo(CreateQuestionWizardComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerSpacer: {
    width: COMPONENT_SIZE.touchTarget,
  },

  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
  },
  stepItem: {
    alignItems: "center",
    flexDirection: "row",
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
    marginRight: SPACING.sm,
  },
  stepConnector: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginHorizontal: SPACING.xs,
  },

  // Scroll content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.base,
    paddingBottom: SPACING["2xl"],
  },
  stepContent: {
    gap: SPACING.lg,
  },
  stepTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  stepSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },

  // Input fields
  inputFieldContainer: {
    gap: SPACING.xs,
  },
  inputFieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  charCounter: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.medium,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  inputHint: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Tips
  tipsContainer: {
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  tipsText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    lineHeight: TYPOGRAPHY.fontSize.xs * TYPOGRAPHY.lineHeight.loose,
  },

  // Sections
  sectionContainer: {
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  sectionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Chips
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Tag input
  tagInputRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.small,
  },
  addTagButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTagsContainer: {
    gap: SPACING.xs,
  },
  selectedTagsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  suggestedTagsContainer: {
    gap: SPACING.sm,
  },
  suggestedTagsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  suggestedTagsLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // Preview
  previewCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  previewBadges: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  previewCategoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  previewCategoryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  previewRewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  previewRewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  previewTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.sm,
  },
  previewBody: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.sm,
  },
  previewTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  previewTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  previewTagText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  previewRewardDetails: {
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  previewRewardItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  previewRewardItemText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
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
});

export default CreateQuestionWizard;
