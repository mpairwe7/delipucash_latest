/**
 * CreateQuestionWizard Component
 * 
 * Multi-step modal wizard for creating questions, inspired by:
 * - Quora: Simple question input with topic selection
 * - Stack Overflow: Title + body + tags + preview
 * - Brainly: Quick question with reward option
 * - JustAnswer: Expert selection + urgency + reward setting
 * 
 * Features:
 * - Step-by-step wizard flow with progress indicator
 * - Question title with character counter
 * - Rich body input with markdown support hints
 * - Category/tag selection with AI suggestions
 * - Reward toggle with amount slider/presets
 * - Max winners and expiry configuration (for reward questions)
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
 *   isAdmin={true}
 *   userPoints={1500}
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
  Zap,
  Clock,
  Users,
  Star,
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
import { PrimaryButton } from "@/components";
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
  /** Whether user is admin (can create reward questions) */
  isAdmin?: boolean;
  /** User's current points (for reward questions) */
  userPoints?: number;
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
  { id: "reward", title: "Reward", icon: Zap },
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

const REWARD_PRESETS = [
  { points: 50, label: "50 pts" },
  { points: 100, label: "100 pts" },
  { points: 250, label: "250 pts" },
  { points: 500, label: "500 pts" },
  { points: 1000, label: "1K pts" },
];

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 12, label: "12 hours" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
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
 * Step 3: Reward settings (admin only)
 */
const RewardStep = memo(function RewardStep({
  formData,
  updateFormData,
  isAdmin,
  userPoints,
  errors,
  colors,
}: {
  formData: QuestionFormData;
  updateFormData: (updates: Partial<QuestionFormData>) => void;
  isAdmin: boolean;
  userPoints: number;
  errors: Record<string, string>;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  if (!isAdmin) {
    return (
      <Animated.View
        entering={SlideInRight.duration(300)}
        exiting={SlideOutLeft.duration(300)}
        style={styles.stepContent}
      >
        <View style={[styles.noRewardContainer, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
          <Zap size={32} color={colors.info} />
          <Text style={[styles.noRewardTitle, { color: colors.text }]}>
            Reward Questions
          </Text>
          <Text style={[styles.noRewardText, { color: colors.textMuted }]}>
            Reward questions are currently available for administrators only. 
            Your question will be posted as a regular community question.
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      style={styles.stepContent}
    >
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Add a reward (Optional)
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
        Incentivize quality answers by offering points as a reward.
      </Text>

      {/* Toggle reward */}
      <Pressable
        onPress={() => {
          updateFormData({ isRewardQuestion: !formData.isRewardQuestion });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        style={[
          styles.rewardToggle,
          {
            backgroundColor: formData.isRewardQuestion 
              ? withAlpha(colors.warning, 0.15) 
              : colors.background,
            borderColor: formData.isRewardQuestion 
              ? colors.warning 
              : colors.border,
          },
        ]}
        accessibilityRole="switch"
        accessibilityState={{ checked: formData.isRewardQuestion }}
        accessibilityLabel="Enable reward for this question"
      >
        <View 
          style={[
            styles.rewardToggleIcon,
            { backgroundColor: withAlpha(colors.warning, 0.15) },
          ]}
        >
          <Zap 
            size={20} 
            color={colors.warning} 
            fill={formData.isRewardQuestion ? colors.warning : "transparent"}
          />
        </View>
        <View style={styles.rewardToggleContent}>
          <Text style={[styles.rewardToggleTitle, { color: colors.text }]}>
            Instant Reward Question
          </Text>
          <Text style={[styles.rewardToggleSubtitle, { color: colors.textMuted }]}>
            Offer points for correct answers
          </Text>
        </View>
        <View 
          style={[
            styles.toggleSwitch,
            {
              backgroundColor: formData.isRewardQuestion 
                ? colors.warning 
                : withAlpha(colors.textMuted, 0.3),
            },
          ]}
        >
          <View 
            style={[
              styles.toggleKnob,
              {
                backgroundColor: colors.primaryText,
                transform: [{ translateX: formData.isRewardQuestion ? 18 : 2 }],
              },
            ]}
          />
        </View>
      </Pressable>

      {formData.isRewardQuestion && (
        <Animated.View entering={FadeIn.duration(300)}>
          {/* Reward amount presets */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Reward Amount
            </Text>
            <View style={styles.presetsContainer}>
              {REWARD_PRESETS.map((preset) => (
                <Pressable
                  key={preset.points}
                  onPress={() => {
                    updateFormData({ rewardAmount: preset.points });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={preset.points > userPoints}
                  style={[
                    styles.presetButton,
                    {
                      backgroundColor: formData.rewardAmount === preset.points 
                        ? colors.warning 
                        : withAlpha(colors.warning, 0.1),
                      opacity: preset.points > userPoints ? 0.5 : 1,
                    },
                  ]}
                >
                  <Star 
                    size={14} 
                    color={formData.rewardAmount === preset.points 
                      ? colors.primaryText 
                      : colors.warning
                    } 
                    fill={formData.rewardAmount === preset.points 
                      ? colors.primaryText 
                      : "transparent"
                    }
                  />
                  <Text
                    style={[
                      styles.presetText,
                      {
                        color: formData.rewardAmount === preset.points 
                          ? colors.primaryText 
                          : colors.warning,
                      },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.pointsBalance, { color: colors.textMuted }]}>
              Your balance: {userPoints.toLocaleString()} points
            </Text>
          </View>

          {/* Max winners */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Users size={16} color={colors.text} />
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Max Winners
              </Text>
            </View>
            <View style={styles.winnersContainer}>
              {[1, 3, 5, 10].map((count) => (
                <Pressable
                  key={count}
                  onPress={() => {
                    updateFormData({ maxWinners: count });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.winnerButton,
                    {
                      backgroundColor: formData.maxWinners === count 
                        ? colors.primary 
                        : withAlpha(colors.primary, 0.1),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.winnerText,
                      {
                        color: formData.maxWinners === count 
                          ? colors.primaryText 
                          : colors.primary,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Expiry */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Clock size={16} color={colors.text} />
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Expires In
              </Text>
            </View>
            <View style={styles.expiryContainer}>
              {EXPIRY_OPTIONS.map((option) => (
                <Pressable
                  key={option.hours}
                  onPress={() => {
                    updateFormData({ expiryHours: option.hours });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.expiryButton,
                    {
                      backgroundColor: formData.expiryHours === option.hours 
                        ? colors.info 
                        : withAlpha(colors.info, 0.1),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.expiryText,
                      {
                        color: formData.expiryHours === option.hours 
                          ? colors.primaryText 
                          : colors.info,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Cost summary */}
          <View 
            style={[
              styles.costSummary,
              { backgroundColor: withAlpha(colors.warning, 0.1) },
            ]}
          >
            <Text style={[styles.costLabel, { color: colors.text }]}>
              Total Cost:
            </Text>
            <Text style={[styles.costValue, { color: colors.warning }]}>
              {(formData.rewardAmount * formData.maxWinners).toLocaleString()} points
            </Text>
          </View>
        </Animated.View>
      )}
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
          {formData.isRewardQuestion && (
            <View 
              style={[
                styles.previewRewardBadge,
                { backgroundColor: withAlpha(colors.warning, 0.12) },
              ]}
            >
              <Zap size={10} color={colors.warning} fill={colors.warning} />
              <Text style={[styles.previewRewardText, { color: colors.warning }]}>
                {formData.rewardAmount} pts
              </Text>
            </View>
          )}
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

        {/* Reward details */}
        {formData.isRewardQuestion && (
          <View 
            style={[
              styles.previewRewardDetails,
              { borderTopColor: colors.border },
            ]}
          >
            <View style={styles.previewRewardItem}>
              <Star size={14} color={colors.warning} />
              <Text style={[styles.previewRewardItemText, { color: colors.text }]}>
                {formData.rewardAmount} points per winner
              </Text>
            </View>
            <View style={styles.previewRewardItem}>
              <Users size={14} color={colors.info} />
              <Text style={[styles.previewRewardItemText, { color: colors.text }]}>
                Up to {formData.maxWinners} winner{formData.maxWinners > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.previewRewardItem}>
              <Clock size={14} color={colors.success} />
              <Text style={[styles.previewRewardItemText, { color: colors.text }]}>
                Expires in {EXPIRY_OPTIONS.find(e => e.hours === formData.expiryHours)?.label}
              </Text>
            </View>
          </View>
        )}
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
  isAdmin = false,
  userPoints = 0,
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
    rewardAmount: 100,
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
        rewardAmount: 100,
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

      case 2: // Reward step
        if (formData.isRewardQuestion) {
          const totalCost = formData.rewardAmount * formData.maxWinners;
          if (totalCost > userPoints) {
            newErrors.rewardAmount = "Insufficient points balance";
          }
        }
        break;
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    
    return true;
  }, [formData, userPoints]);

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
          <RewardStep
            formData={formData}
            updateFormData={updateFormData}
            isAdmin={isAdmin}
            userPoints={userPoints}
            errors={errors}
            colors={colors}
          />
        );
      case 3:
        return (
          <PreviewStep
            formData={formData}
            colors={colors}
          />
        );
      default:
        return null;
    }
  }, [currentStep, formData, updateFormData, errors, colors, categories, suggestedTags, isAdmin, userPoints]);

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

  // Reward step
  noRewardContainer: {
    alignItems: "center",
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  noRewardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  noRewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  rewardToggle: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    gap: SPACING.md,
  },
  rewardToggleIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardToggleContent: {
    flex: 1,
  },
  rewardToggleTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  rewardToggleSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  presetsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  presetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  presetText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  pointsBalance: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
  winnersContainer: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  winnerButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  winnerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  expiryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  expiryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  expiryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  costSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  costLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  costValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
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
