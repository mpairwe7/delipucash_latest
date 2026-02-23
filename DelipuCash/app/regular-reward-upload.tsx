/**
 * Regular Reward Upload Screen — 3-step wizard
 * Admin-only screen for creating regular (non-instant) reward questions.
 *
 * Steps:
 * 1. Question & Answers — question text, options, correct answer selector
 * 2. Rewards — reward amount/points sync, optional expiry days, optional max winners
 * 3. Review — read-only preview with edit links
 */

import { PrimaryButton, SectionHeader } from "@/components";
import {
  WizardStepIndicator,
  WizardScreenHeader,
  WizardFooter,
  OptionInputGroup,
  CorrectAnswerSelector,
  RewardAmountInput,
  ReviewRow,
  reviewStyles,
  buildOptionsPayload,
  optionIndexToKey,
} from "@/components/reward";
import type { WizardStep } from "@/components/reward";
import { useCreateRewardQuestion } from "@/services/hooks";
import { UserRole } from "@/types";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useToast } from "@/components/ui/Toast";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  CheckCircle2,
  Coins,
  Edit3,
  Eye,
  HelpCircle,
} from "lucide-react-native";
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  pointsToCash,
  cashToPoints,
} from "@/store/InstantRewardStore";
import { useRewardConfig } from "@/services/configHooks";

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS: WizardStep[] = [
  { id: "question", title: "Question", icon: HelpCircle },
  { id: "rewards", title: "Rewards", icon: Coins },
  { id: "review", title: "Review", icon: Eye },
];

const MAX_QUESTION_LENGTH = 2000;
const MIN_QUESTION_LENGTH = 10;

// ============================================================================
// SCREEN
// ============================================================================

export default function RegularRewardUploadScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data: user, loading: userLoading } = useUser();
  const createQuestion = useCreateRewardQuestion();
  const { showToast } = useToast();
  const { data: rewardConfig } = useRewardConfig();
  const submitDebounceRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(-1);
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardPoints, setRewardPoints] = useState("");
  const isSyncingRef = useRef(false);
  const [expiryDays, setExpiryDays] = useState("");
  const [maxWinners, setMaxWinners] = useState("");

  // Bidirectional sync: UGX ↔ Points
  const handleRewardAmountChange = useCallback((text: string) => {
    setRewardAmount(text);
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const ugx = parseFloat(text);
    setRewardPoints(isNaN(ugx) || ugx <= 0 ? "" : String(cashToPoints(ugx)));
    isSyncingRef.current = false;
  }, []);

  const handleRewardPointsChange = useCallback((text: string) => {
    setRewardPoints(text);
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const pts = parseFloat(text);
    setRewardAmount(isNaN(pts) || pts <= 0 ? "" : String(pointsToCash(pts)));
    isSyncingRef.current = false;
  }, []);

  const handleOptionChange = useCallback((index: number, value: string) => {
    setOptions((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[index] = value;
      return next;
    });
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────

  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 0: {
        const trimmed = questionText.trim();
        if (!trimmed) {
          triggerHaptic("warning");
          showToast({ message: "Question text is required", type: "warning" });
          return false;
        }
        if (trimmed.length < MIN_QUESTION_LENGTH) {
          triggerHaptic("warning");
          showToast({
            message: `Question must be at least ${MIN_QUESTION_LENGTH} characters`,
            type: "warning",
          });
          return false;
        }
        const filledOpts = options.filter((o) => o.trim().length > 0);
        if (filledOpts.length < 2) {
          triggerHaptic("warning");
          showToast({
            message: "At least 2 options are required",
            type: "warning",
          });
          return false;
        }
        if (correctAnswerIndex < 0 || !options[correctAnswerIndex]?.trim()) {
          triggerHaptic("warning");
          showToast({
            message: "Please select the correct answer",
            type: "warning",
          });
          return false;
        }
        return true;
      }
      case 1: {
        const parsedReward = parseFloat(rewardAmount);
        if (!rewardAmount.trim() || isNaN(parsedReward) || parsedReward < 1 || parsedReward > 1_000_000) {
          triggerHaptic("warning");
          showToast({
            message: "Reward amount must be between 1 and 1,000,000 UGX",
            type: "warning",
          });
          return false;
        }
        if (expiryDays.trim()) {
          const parsed = parseInt(expiryDays);
          if (isNaN(parsed) || parsed < 1 || parsed > 365) {
            triggerHaptic("warning");
            showToast({
              message: "Expiry must be between 1 and 365 days",
              type: "warning",
            });
            return false;
          }
        }
        if (maxWinners.trim()) {
          const parsed = parseInt(maxWinners);
          if (isNaN(parsed) || parsed < 1 || parsed > 100) {
            triggerHaptic("warning");
            showToast({
              message: "Max winners must be between 1 and 100",
              type: "warning",
            });
            return false;
          }
        }
        return true;
      }
      default:
        return true;
    }
  }, [questionText, options, correctAnswerIndex, rewardAmount, expiryDays, maxWinners, showToast]);

  // ── Form reset ─────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setQuestionText("");
    setOptions(["", "", "", ""]);
    setCorrectAnswerIndex(-1);
    setRewardAmount("");
    setRewardPoints("");
    setExpiryDays("");
    setMaxWinners("");
    setCurrentStep(0);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (submitDebounceRef.current) return;
    submitDebounceRef.current = true;
    debounceTimerRef.current = setTimeout(() => {
      submitDebounceRef.current = false;
    }, 1000);

    if (!user) {
      triggerHaptic("error");
      showToast({
        message: "User not found. Please log in again.",
        type: "error",
      });
      return;
    }

    const parsedReward = parseFloat(rewardAmount);
    const optionsPayload = buildOptionsPayload(options);
    const correctAnswerKey = optionIndexToKey(correctAnswerIndex);

    // Build optional fields
    const parsedExpiryDays = expiryDays.trim() ? parseInt(expiryDays) : undefined;
    const expiryTime = parsedExpiryDays
      ? new Date(Date.now() + parsedExpiryDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const parsedMaxWinners = maxWinners.trim() ? parseInt(maxWinners) : undefined;

    try {
      await createQuestion.mutateAsync({
        text: questionText.trim(),
        options: optionsPayload,
        correctAnswer: correctAnswerKey,
        rewardAmount: parsedReward,
        expiryTime,
        userId: user.id,
        isInstantReward: false,
        maxWinners: parsedMaxWinners,
      });

      triggerHaptic("success");
      showToast({
        message: "Reward question created successfully!",
        type: "success",
        duration: 4000,
      });
      resetForm();
      navigateTimerRef.current = setTimeout(() => router.back(), 2000);
    } catch (error) {
      triggerHaptic("error");
      showToast({
        message:
          error instanceof Error ? error.message : "Failed to create question",
        type: "error",
      });
    }
  }, [user, questionText, options, correctAnswerIndex, rewardAmount, expiryDays, maxWinners, createQuestion, showToast, resetForm]);

  // ── Navigation ──────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (currentStep === STEPS.length - 1) {
      handleSubmit();
      return;
    }
    if (!validateStep(currentStep)) return;
    triggerHaptic("light");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setCurrentStep((s) => s + 1);
  }, [currentStep, validateStep, handleSubmit]);

  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      router.back();
      return;
    }
    triggerHaptic("light");
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleStepPress = useCallback((step: number) => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setCurrentStep(step);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────

  const conversionHint = rewardConfig
    ? `${rewardConfig.pointsToCashDenominator} points = ${rewardConfig.pointsToCashNumerator} UGX`
    : "1 point = 100 UGX";

  // ── Admin access check (after all hooks) ──────────────────────────────

  const isAdmin =
    user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;

  if (userLoading) {
    return (
      <View style={[styles.container, styles.accessDeniedContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.accessDeniedContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>Access Denied</Text>
        <Text style={[styles.accessDeniedSubtitle, { color: colors.textMuted }]}>
          Only administrators can create reward questions.
        </Text>
        <PrimaryButton title="Go Back" onPress={() => router.back()} style={{ marginTop: SPACING.lg }} />
      </View>
    );
  }

  // ── Step content renderers ──────────────────────────────────────────────

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderQuestionStep();
      case 1:
        return renderRewardsStep();
      case 2:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderQuestionStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} key="step-0">
      <SectionHeader
        title="Question & Answers"
        subtitle="Create a reward question with multiple choice options"
        icon={<HelpCircle size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
      />

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Question Text *</Text>
        <TextInput
          style={[
            styles.uploadInput,
            styles.multilineInput,
            {
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          placeholder="Enter the question (min 10 characters)"
          placeholderTextColor={colors.textMuted}
          value={questionText}
          onChangeText={setQuestionText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={MAX_QUESTION_LENGTH}
          accessibilityLabel="Question text input"
          accessibilityHint="Enter the question text for the reward"
        />
        <Text
          style={[
            styles.charCounter,
            {
              color:
                questionText.length > MAX_QUESTION_LENGTH * 0.9
                  ? colors.error
                  : colors.textMuted,
            },
          ]}
        >
          {questionText.length}/{MAX_QUESTION_LENGTH}
        </Text>
      </View>

      <SectionHeader
        title="Answer Options"
        subtitle="Provide 2-4 multiple choice options"
        icon={<CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
      />
      <OptionInputGroup options={options} onChangeOption={handleOptionChange} />

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Correct Answer *</Text>
        <CorrectAnswerSelector
          options={options}
          selectedIndex={correctAnswerIndex}
          onSelect={setCorrectAnswerIndex}
        />
      </View>
    </Animated.View>
  );

  const renderRewardsStep = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} key="step-1">
      <SectionHeader
        title="Reward Settings"
        subtitle="Configure reward amount and optional limits"
        icon={<Coins size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />}
      />

      <RewardAmountInput
        rewardAmount={rewardAmount}
        rewardPoints={rewardPoints}
        onAmountChange={handleRewardAmountChange}
        onPointsChange={handleRewardPointsChange}
        conversionHint={conversionHint}
      />

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.xs }]}>
          <Text style={[styles.label, { color: colors.text }]}>Expiry (days)</Text>
          <TextInput
            style={[
              styles.uploadInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            placeholder="No expiry"
            placeholderTextColor={colors.textMuted}
            value={expiryDays}
            onChangeText={setExpiryDays}
            keyboardType="numeric"
            accessibilityLabel="Expiry in days (optional)"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.xs }]}>
          <Text style={[styles.label, { color: colors.text }]}>Max Winners</Text>
          <TextInput
            style={[
              styles.uploadInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            placeholder="Unlimited"
            placeholderTextColor={colors.textMuted}
            value={maxWinners}
            onChangeText={setMaxWinners}
            keyboardType="numeric"
            accessibilityLabel="Maximum number of winners (optional)"
          />
        </View>
      </View>
    </Animated.View>
  );

  const renderReviewStep = () => {
    const correctKey = optionIndexToKey(correctAnswerIndex);
    const optionsMap = buildOptionsPayload(options);
    const parsedReward = parseFloat(rewardAmount) || 0;

    return (
      <Animated.View entering={SlideInRight} exiting={SlideOutLeft} key="step-2">
        <SectionHeader
          title="Review"
          subtitle="Confirm all details before submitting"
          icon={<Eye size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
        />

        {/* Question section */}
        <View style={[reviewStyles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={reviewStyles.reviewCardHeader}>
            <Text style={[reviewStyles.reviewCardTitle, { color: colors.textMuted }]}>Question & Answers</Text>
            <Pressable
              onPress={() => handleStepPress(0)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit question and answers"
            >
              <Edit3 size={14} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={[reviewStyles.reviewText, { color: colors.text, marginBottom: SPACING.sm }]}>
            {questionText.trim()}
          </Text>
          {Object.entries(optionsMap).map(([key, text]) => (
            <View key={key} style={reviewStyles.reviewOptionRow}>
              <Text
                style={[
                  reviewStyles.reviewOptionKey,
                  {
                    color: key === correctKey ? colors.success : colors.textMuted,
                    fontFamily:
                      key === correctKey
                        ? TYPOGRAPHY.fontFamily.bold
                        : TYPOGRAPHY.fontFamily.medium,
                  },
                ]}
              >
                {key}.
              </Text>
              <Text
                style={[
                  reviewStyles.reviewOptionText,
                  {
                    color: key === correctKey ? colors.success : colors.text,
                  },
                ]}
              >
                {text}
                {key === correctKey ? " ✓" : ""}
              </Text>
            </View>
          ))}
        </View>

        {/* Rewards section */}
        <View style={[reviewStyles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={reviewStyles.reviewCardHeader}>
            <Text style={[reviewStyles.reviewCardTitle, { color: colors.textMuted }]}>Rewards</Text>
            <Pressable
              onPress={() => handleStepPress(1)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit rewards"
            >
              <Edit3 size={14} color={colors.primary} />
            </Pressable>
          </View>
          <ReviewRow label="Reward" value={`${parsedReward.toLocaleString()} UGX`} />
          <ReviewRow
            label="Expiry"
            value={expiryDays.trim() ? `${expiryDays} days` : "No expiry"}
          />
          <ReviewRow
            label="Max Winners"
            value={maxWinners.trim() ? maxWinners : "Unlimited"}
          />
        </View>
      </Animated.View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + SPACING.lg,
              paddingBottom: SPACING["2xl"],
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <WizardScreenHeader
            title="Create Regular Reward"
            onBack={() => router.back()}
          />
          <WizardStepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepPress={handleStepPress}
          />
          <View style={styles.stepContent}>{renderStep()}</View>
        </ScrollView>

        <View style={{ paddingBottom: insets.bottom }}>
          <WizardFooter
            currentStep={currentStep}
            totalSteps={STEPS.length}
            onBack={handleBack}
            onNext={handleNext}
            isSubmitting={createQuestion.isPending}
            submitLabel="Create Reward"
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  stepContent: {
    marginTop: SPACING.md,
  },
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
  charCounter: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: "right",
    marginTop: SPACING.xs,
  },

  // Access denied
  accessDeniedContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING["2xl"],
  },
  accessDeniedTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
  },
  accessDeniedSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: "center",
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
});
