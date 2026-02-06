import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Lock,
  MessageCircle,
  RefreshCw,
  Shield,
  Star,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { PrimaryButton } from "@/components";
import { formatCurrency, formatDuration } from "@/services";
import { useCheckSurveyAttempt, useSubmitSurvey, useSurvey } from "@/services/hooks";
import { useSurveyAttemptStore } from "@/store/SurveyAttemptStore";
import { UploadSurvey } from "@/types";
import { useAuth } from "@/utils/auth";
import {
  BORDER_WIDTH,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";

// Unique ID for InputAccessoryView (iOS keyboard toolbar)
const INPUT_ACCESSORY_VIEW_ID = "survey-input-accessory";

type QuestionType = "rating" | "checkbox" | "radio" | "text";

type AnswerValue = string | number | string[];

interface ParsedOption {
  id: string;
  text: string;
}

interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: ParsedOption[];
  maxRating?: number;
  placeholder?: string | null;
}

interface SurveyDisplay {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  estimatedTime: number;
  questions: SurveyQuestion[];
}

const parseQuestionOptions = (question: UploadSurvey): ParsedOption[] => {
  try {
    const parsed = JSON.parse(question.options || "[]");
    if (Array.isArray(parsed)) {
      return parsed.map((opt, index) => ({
        id: typeof opt === "string" ? `opt_${index}` : (opt as { id?: string }).id || `opt_${index}`,
        text: typeof opt === "string" ? opt : String((opt as { text?: string; label?: string; value?: string }).text ?? (opt as { label?: string }).label ?? (opt as { value?: string }).value ?? opt),
      }));
    }

    if (parsed && typeof parsed === "object") {
      if (Array.isArray((parsed as { options?: unknown[] }).options)) {
        return (parsed as { options: unknown[] }).options.map((opt, index) => ({
          id: typeof opt === "string" ? `opt_${index}` : (opt as { id?: string }).id || `opt_${index}`,
          text: typeof opt === "string" ? opt : String((opt as { label?: string; text?: string; value?: string }).label ?? (opt as { text?: string }).text ?? (opt as { value?: string }).value ?? opt),
        }));
      }

      if (Array.isArray((parsed as { labels?: string[] }).labels)) {
        return (parsed as { labels: string[] }).labels.map((label, index) => ({
          id: `opt_${index}`,
          text: label,
        }));
      }
    }

    return [];
  } catch {
    return [];
  }
};

const getMaxRating = (question: UploadSurvey): number => {
  if (question.maxValue) return question.maxValue;
  try {
    const parsed = JSON.parse(question.options || "{}");
    if (parsed && typeof parsed === "object") {
      if ((parsed as { max?: number }).max) return (parsed as { max: number }).max;
      if (Array.isArray((parsed as { labels?: string[] }).labels)) return (parsed as { labels: string[] }).labels.length;
    }
  } catch {
    // ignore parse errors
  }
  return 5;
};

const SurveyAttemptScreen = (): React.ReactElement => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();

  // Auth state for single attempt enforcement
  const { auth } = useAuth();
  const userId = auth?.user?.id;

  // Server state: TanStack Query
  const { data: surveyData, isLoading, error, refetch } = useSurvey(id || "");
  const submitSurveyMutation = useSubmitSurvey();
  
  // Check if user has already attempted this survey (single attempt enforcement)
  const { 
    data: attemptStatus, 
    isLoading: checkingAttempt 
  } = useCheckSurveyAttempt(id || "", userId);

  // Client state: Zustand store (draft auto-save, progress tracking)
  const attemptStore = useSurveyAttemptStore();

  // Local UI state
  const [showReview, setShowReview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Refs for keyboard handling and scroll
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.95)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Initialize attempt store when survey loads
  useEffect(() => {
    if (surveyData && id && !attemptStatus?.hasAttempted) {
      const totalQ = surveyData.uploads?.length || 0;
      if (totalQ > 0) {
        attemptStore.startAttempt(id, totalQ);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyData, id, attemptStatus?.hasAttempted]);

  // Clean up on unmount — save draft if not submitted
  useEffect(() => {
    return () => {
      if (attemptStore.submissionStatus !== 'submitted') {
        attemptStore.abandonAttempt();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for reduced motion preference (accessibility - WCAG 2.1)
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion
    );
    return () => subscription.remove();
  }, []);

  // Keyboard visibility handling for scroll accessibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        // Scroll to keep input visible
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: !isReducedMotion });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isReducedMotion]);

  const survey: SurveyDisplay | null = useMemo(() => {
    if (!surveyData) return null;
    return {
      id: surveyData.id,
      title: surveyData.title,
      description: surveyData.description || "",
      rewardAmount: surveyData.rewardAmount || 0,
      estimatedTime: (surveyData.uploads?.length || 0) * 2,
      questions: (surveyData.uploads || []).map((q: UploadSurvey) => ({
        id: q.id,
        text: q.text,
        type: (q.type as QuestionType) || "text",
        required: true,
        options: parseQuestionOptions(q),
        maxRating: getMaxRating(q),
        placeholder: q.placeholder,
      })),
    };
  }, [surveyData]);

  // Derive state from store
  const currentIndex = attemptStore.currentQuestionIndex;
  const answers = attemptStore.answers;

  const question = survey?.questions[currentIndex];
  const isLastQuestion = survey ? currentIndex === survey.questions.length - 1 : false;
  const progress = survey ? ((currentIndex + 1) / survey.questions.length) * 100 : 0;

  const getDefaultValue = (type: QuestionType): AnswerValue => {
    switch (type) {
      case "rating":
        return 0;
      case "checkbox":
        return [];
      case "radio":
      case "text":
      default:
        return "";
    }
  };

  const currentAnswer = question ? answers[question.id] ?? getDefaultValue(question.type) : "";

  const isQuestionAnswered = (): boolean => {
    if (!question) return false;
    const answer = currentAnswer;

    switch (question.type) {
      case "rating":
        return typeof answer === "number" && answer > 0;
      case "checkbox":
        return Array.isArray(answer) && answer.length > 0;
      case "radio":
        return typeof answer === "string" && answer.length > 0;
      case "text":
        return typeof answer === "string" && answer.trim().length > 0;
      default:
        return false;
    }
  };

  const answeredCount = survey?.questions.reduce((count, q) => {
    const value = answers[q.id];
    if (!value) return count;
    switch (q.type) {
      case "rating":
        return typeof value === "number" && value > 0 ? count + 1 : count;
      case "checkbox":
        return Array.isArray(value) && value.length > 0 ? count + 1 : count;
      case "radio":
        return typeof value === "string" && value.length > 0 ? count + 1 : count;
      case "text":
        return typeof value === "string" && value.trim().length > 0 ? count + 1 : count;
      default:
        return count;
    }
  }, 0) || 0;

  // Use store's setAnswer for auto-save
  const setAnswer = (value: AnswerValue): void => {
    if (!question) return;
    attemptStore.setAnswer(question.id, value);
  };

  const handleNext = (): void => {
    if (!question || (question.required && !isQuestionAnswered())) return;

    // Haptic feedback on navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (isLastQuestion) {
      openReviewModal();
    } else {
      attemptStore.goNext();
    }
  };

  const handlePrevious = (): void => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      attemptStore.goPrevious();
    }
  };

  const handleSubmit = (): void => {
    if (!survey || !userId) {
      Alert.alert("Error", "You must be logged in to submit a survey.");
      return;
    }

    // Guard against double-submit
    if (attemptStore.submissionStatus === 'submitting' || attemptStore.submissionStatus === 'submitted') {
      return;
    }

    attemptStore.setSubmitting();

    submitSurveyMutation.mutate(
      { surveyId: survey.id, responses: answers, userId },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          attemptStore.setSubmitted(data.reward || 0);
          closeReviewModal();
          setShowSuccess(true);
          // Animate success
          Animated.spring(successScale, {
            toValue: 1,
            useNativeDriver: true,
            damping: 12,
            stiffness: 120,
          }).start();
        },
        onError: (err) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          const message = err.message || "Failed to submit survey. Please try again.";
          
          // Check for already attempted error
          if (message.toLowerCase().includes('already completed') || message.toLowerCase().includes('already attempted')) {
            attemptStore.setSubmissionError(message);
            closeReviewModal();
            Alert.alert(
              "Already Completed",
              "You have already completed this survey. Only one attempt per user is allowed.",
              [{ text: "OK", onPress: () => router.back() }]
            );
          } else {
            attemptStore.setSubmissionError(message);
            Alert.alert("Submission Failed", message, [
              { text: "Try Again", onPress: () => attemptStore.resetSubmission() },
              { text: "Cancel", style: "cancel" },
            ]);
          }
        },
      }
    );
  };

  const openReviewModal = (): void => {
    setShowReview(true);
    modalOpacity.setValue(0);
    modalScale.setValue(0.95);
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 14,
        stiffness: 140,
      }),
    ]).start();
  };

  const closeReviewModal = (): void => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(modalScale, {
        toValue: 0.95,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setShowReview(false));
  };

  useEffect(() => {
    const duration = isReducedMotion ? 0 : 220;
    slideAnim.setValue(isReducedMotion ? 0 : 24);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentIndex, slideAnim, isReducedMotion]);

  // Dismiss keyboard helper
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  // ============================================================================
  // SUCCESS STATE
  // ============================================================================
  if (showSuccess) {
    return (
      <View style={[styles.stateContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Animated.View
          style={[
            styles.successIcon,
            {
              backgroundColor: withAlpha(colors.primary, 0.12),
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <Award size={56} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>Survey Completed!</Text>
        <Text style={[styles.stateText, { color: colors.textMuted, textAlign: 'center', maxWidth: 300 }]}>
          Thank you for your responses. Your feedback is valuable.
        </Text>
        {(attemptStore.submittedReward ?? 0) > 0 && (
          <View style={[styles.rewardBadge, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
            <CheckCircle2 size={18} color={colors.primary} strokeWidth={1.5} />
            <Text style={[styles.rewardBadgeText, { color: colors.primary }]}>
              You earned {formatCurrency(attemptStore.submittedReward || 0)}!
            </Text>
          </View>
        )}
        <PrimaryButton
          title="Back to Surveys"
          onPress={() => {
            attemptStore.reset();
            router.back();
          }}
          style={{ marginTop: SPACING.xl, minWidth: 200 }}
          accessibilityLabel="Go back to browse surveys"
        />
      </View>
    );
  }

  // Loading state
  if (isLoading || checkingAttempt) {
    return (
      <View style={[styles.stateContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>
          {checkingAttempt ? "Checking eligibility..." : "Loading survey..."}
        </Text>
      </View>
    );
  }

  // Already attempted state - Single attempt enforcement
  if (attemptStatus?.hasAttempted) {
    return (
      <View style={[styles.stateContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={[styles.alreadyAttemptedIcon, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
          <Lock size={48} color={colors.warning} strokeWidth={1.5} />
        </View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>Already Completed</Text>
        <Text style={[styles.stateText, { color: colors.textMuted, textAlign: 'center', maxWidth: 280 }]}>
          You have already completed this survey. Each survey can only be attempted once per user.
        </Text>
        {attemptStatus.attemptedAt && (
          <View style={[styles.attemptedDateBadge, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
            <Clock size={14} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.attemptedDateText, { color: colors.textMuted }]}>
              Completed on {new Date(attemptStatus.attemptedAt).toLocaleDateString()}
            </Text>
          </View>
        )}
        <PrimaryButton 
          title="Browse Other Surveys" 
          onPress={() => router.back()} 
          style={{ marginTop: SPACING.xl }}
          accessibilityLabel="Go back to browse other surveys"
        />
      </View>
    );
  }

  if (error || !survey || survey.questions.length === 0) {
    return (
      <View style={[styles.stateContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <FileText size={48} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.stateTitle, { color: colors.text }]}>Survey unavailable</Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>We could not load this survey right now.</Text>
        <PrimaryButton title="Go back" onPress={() => router.back()} style={{ marginTop: SPACING.lg }} />
      </View>
    );
  }

  const renderOption = (option: ParsedOption): React.ReactElement => {
    if (!question) return <></>;

    if (question.type === "radio") {
      const isSelected = currentAnswer === option.id;
      return (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.optionCard,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? withAlpha(colors.primary, 0.12) : colors.card,
            },
          ]}
          onPress={() => setAnswer(option.id)}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected }}
        >
          <View
            style={[
              styles.radioOuter,
              { borderColor: isSelected ? colors.primary : colors.textMuted },
            ]}
          >
            {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
          </View>
          <Text style={[styles.optionText, { color: colors.text }]}>{option.text}</Text>
        </TouchableOpacity>
      );
    }

    if (question.type === "checkbox") {
      const selected = Array.isArray(currentAnswer) && currentAnswer.includes(option.id);
      const toggle = (): void => {
        const current = Array.isArray(currentAnswer) ? currentAnswer : [];
        const next = selected ? current.filter((id) => id !== option.id) : [...current, option.id];
        setAnswer(next);
      };

      return (
        <TouchableOpacity
          key={option.id}
          style={[
            styles.optionCard,
            {
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? withAlpha(colors.primary, 0.12) : colors.card,
            },
          ]}
          onPress={toggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: selected ? colors.primary : colors.textMuted,
                backgroundColor: selected ? colors.primary : "transparent",
              },
            ]}
          >
            {selected && <CheckCircle2 size={14} color={colors.primaryText} strokeWidth={2} />}
          </View>
          <Text style={[styles.optionText, { color: colors.text }]}>{option.text}</Text>
        </TouchableOpacity>
      );
    }

    return <></>;
  };

  const renderQuestionBody = (): React.ReactNode => {
    if (!question) return null;

    switch (question.type) {
      case "radio":
      case "checkbox":
        return (
          <View style={styles.optionList}>
            {(question.options || []).map(renderOption)}
          </View>
        );
      case "rating": {
        const max = question.maxRating || 5;
        const value = typeof currentAnswer === "number" ? currentAnswer : 0;
        return (
          <View style={styles.ratingRow}>
            {Array.from({ length: max }).map((_, index) => {
              const level = index + 1;
              const active = value >= level;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => setAnswer(level)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${level}`}
                  style={styles.ratingStar}
                  activeOpacity={0.8}
                >
                  <Star
                    size={28}
                    color={active ? colors.warning : colors.textMuted}
                    fill={active ? colors.warning : "transparent"}
                    strokeWidth={1.4}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      case "text":
      default:
        return (
          <View style={styles.textFieldWrapper}>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder={question.placeholder || "Type your answer"}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={typeof currentAnswer === "string" ? currentAnswer : ""}
              onChangeText={(text) => setAnswer(text)}
              // Accessibility improvements
              accessibilityLabel={`Answer for: ${question.text}`}
              accessibilityHint="Enter your text response"
              // Keyboard handling for better scroll accessibility
              inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_VIEW_ID : undefined}
              returnKeyType="done"
              blurOnSubmit={false}
              onFocus={() => {
                // Scroll to make input visible when keyboard appears
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: !isReducedMotion });
                }, 150);
              }}
            />
            <View style={styles.helperRow}>
              <MessageCircle size={16} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>Short, clear answers work best.</Text>
            </View>
          </View>
        );
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar style={statusBarStyle} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + SPACING["4xl"] + (isKeyboardVisible ? 100 : 0) 
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + SPACING.lg,
              backgroundColor: withAlpha(colors.primary, 0.08),
              borderBottomColor: withAlpha(colors.primary, 0.1),
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ChevronLeft size={18} color={colors.text} strokeWidth={1.6} />
            </TouchableOpacity>

            <View style={styles.heroChips}>
              <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.primary, 0.16) }]}>
                <Shield size={14} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.metaText, { color: colors.primary }]}>Secure response</Text>
              </View>
              <View style={[styles.metaChip, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
                <Clock size={14} color={colors.text} strokeWidth={1.5} />
                <Text style={[styles.metaText, { color: colors.text }]}>~{formatDuration(survey.estimatedTime)}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.surveyTitle, { color: colors.text }]}>{survey.title}</Text>
          {survey.description ? (
            <Text style={[styles.surveyDescription, { color: colors.textMuted }]}>{survey.description}</Text>
          ) : null}

          <View style={styles.rewardRow}>
            <View style={[styles.rewardPill, { backgroundColor: colors.card, borderColor: withAlpha(colors.primary, 0.2) }]}>
              <CheckCircle2 size={16} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.rewardText, { color: colors.primary }]}>Reward: {formatCurrency(survey.rewardAmount)}</Text>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.card, borderColor: withAlpha(colors.textMuted, 0.25) }]}>
              <ListChecks size={16} color={colors.text} strokeWidth={1.5} />
              <Text style={[styles.rewardText, { color: colors.text }]}>Questions: {survey.questions.length}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.progressContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.progressTrack, { backgroundColor: withAlpha(colors.textMuted, 0.12) }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Question {currentIndex + 1} of {survey.questions.length}</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACING.base, gap: SPACING.sm, marginBottom: SPACING.lg }}
        >
          {survey.questions.map((q, idx) => {
            const answered = !!answers[q.id] && ((): boolean => {
              const value = answers[q.id];
              switch (q.type) {
                case "rating":
                  return typeof value === "number" && value > 0;
                case "checkbox":
                  return Array.isArray(value) && value.length > 0;
                case "radio":
                  return typeof value === "string" && value.length > 0;
                case "text":
                  return typeof value === "string" && value.trim().length > 0;
                default:
                  return false;
              }
            })();

            return (
              <TouchableOpacity
                key={q.id}
                onPress={() => attemptStore.setCurrentIndex(idx)}
                style={[
                  styles.stepChip,
                  {
                    borderColor: idx === currentIndex ? colors.primary : colors.border,
                    backgroundColor: idx === currentIndex ? withAlpha(colors.primary, 0.16) : colors.card,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Go to question ${idx + 1}`}
              >
                <Text style={[styles.stepNumber, { color: idx === currentIndex ? colors.primary : colors.text }]}>
                  {idx + 1}
                </Text>
                <View style={[styles.stepStatus, { backgroundColor: answered ? withAlpha(colors.primary, 0.8) : withAlpha(colors.textMuted, 0.15) }]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Animated.View
          style={[
            styles.questionCard,
            {
              backgroundColor: colors.card,
              borderColor: withAlpha(colors.border, 0.7),
              shadowColor: withAlpha(colors.text, 0.1),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.questionHeader}>
            <View style={[styles.questionBadge, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
              <Text style={[styles.questionBadgeText, { color: colors.primary }]}>Question {currentIndex + 1}</Text>
            </View>
            {question?.required && (
              <View style={[styles.requiredPill, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
                <Text style={[styles.requiredText, { color: colors.error }]}>Required</Text>
              </View>
            )}
          </View>

          <Text style={[styles.questionTitle, { color: colors.text }]}>{question?.text}</Text>
          <View style={styles.helperRow}>
            <MessageCircle size={16} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.helperText, { color: colors.textMuted }]}>Answer thoughtfully to unlock rewards.</Text>
          </View>

          {renderQuestionBody()}
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.navBar,
          {
            paddingBottom: insets.bottom + SPACING.sm,
            borderTopColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        {currentIndex > 0 && (
          <PrimaryButton
            title="Previous"
            variant="outline"
            onPress={handlePrevious}
            style={styles.navButton}
            leftIcon={<ChevronLeft size={16} color={colors.text} strokeWidth={1.5} />}
          />
        )}
        <PrimaryButton
          title={isLastQuestion ? "Review & Submit" : "Next"}
          onPress={handleNext}
          disabled={(question?.required && !isQuestionAnswered()) || attemptStore.submissionStatus === 'submitting'}
          loading={attemptStore.submissionStatus === 'submitting' && isLastQuestion}
          style={styles.navButton}
          rightIcon={!isLastQuestion ? <ChevronRight size={16} color={colors.primaryText} strokeWidth={1.5} /> : <CheckCircle2 size={16} color={colors.primaryText} strokeWidth={1.5} />}
        />
      </View>

      <Modal transparent visible={showReview} animationType="none" onRequestClose={closeReviewModal}>
        <Animated.View
          style={[
            styles.modalOverlay,
            { backgroundColor: "rgba(0,0,0,0.4)", opacity: modalOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                transform: [{ scale: modalScale }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: withAlpha(colors.primary, 0.18) }]}>
                <ListChecks size={22} color={colors.primary} strokeWidth={1.6} />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Review your responses</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Answered {answeredCount} of {survey.questions.length} questions</Text>
              </View>
            </View>

            <View style={styles.modalStats}>
              <View style={styles.modalStatRow}>
                <Clock size={18} color={colors.text} strokeWidth={1.5} />
                <Text style={[styles.modalStatText, { color: colors.text }]}>Estimated time left ~ {formatDuration(Math.max(survey.questions.length - currentIndex - 1, 0) * 2)}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <CheckCircle2 size={18} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.modalStatText, { color: colors.text }]}>Reward on completion: {formatCurrency(survey.rewardAmount)}</Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <PrimaryButton
                title="Submit now"
                onPress={handleSubmit}
                loading={attemptStore.submissionStatus === 'submitting'}
                disabled={attemptStore.submissionStatus === 'submitting'}
                rightIcon={<CheckCircle2 size={16} color={colors.primaryText} strokeWidth={1.5} />}
                accessibilityLabel="Submit survey responses"
              />
              <PrimaryButton
                title="Keep editing"
                variant="outline"
                onPress={closeReviewModal}
                leftIcon={<X size={16} color={colors.text} strokeWidth={1.5} />}
                accessibilityLabel="Continue editing responses"
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* iOS Keyboard Accessory View for better scroll accessibility */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={INPUT_ACCESSORY_VIEW_ID}>
          <View 
            style={[
              styles.keyboardAccessory, 
              { 
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              }
            ]}
          >
            <TouchableOpacity 
              onPress={dismissKeyboard}
              style={styles.keyboardDismissButton}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <ChevronDown size={20} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.keyboardDismissText, { color: colors.textMuted }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.lg,
    borderBottomWidth: BORDER_WIDTH.hairline,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    gap: SPACING.base,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  heroChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  surveyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["4xl"],
    marginBottom: SPACING.xs,
  },
  surveyDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  rewardRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  progressContainer: {
    marginHorizontal: SPACING.base,
    marginTop: SPACING.lg,
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.hairline,
    ...SHADOWS.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADIUS.full,
  },
  progressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  stepChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },
  stepNumber: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  stepStatus: {
    width: 18,
    height: 6,
    borderRadius: RADIUS.full,
  },
  questionCard: {
    marginHorizontal: SPACING.base,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.hairline,
    ...SHADOWS.md,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  questionBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  questionBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  requiredPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  requiredText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
    lineHeight: TYPOGRAPHY.fontSize["3xl"] * TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.sm,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  helperText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  optionList: {
    gap: SPACING.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: BORDER_WIDTH.base,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.sm,
    borderWidth: BORDER_WIDTH.base,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "center",
    paddingVertical: SPACING.md,
  },
  ratingStar: {
    padding: SPACING.xs,
  },
  textFieldWrapper: {
    gap: SPACING.sm,
  },
  textInput: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    minHeight: 120,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  navBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER_WIDTH.hairline,
  },
  navButton: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.base,
  },
  modalCard: {
    width: "100%",
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.hairline,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderText: {
    flex: 1,
    gap: SPACING.xs,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  modalStats: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    backgroundColor: withAlpha("#000000", 0.02),
  },
  modalStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  modalStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  modalButtons: {
    gap: SPACING.sm,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  stateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
  },
  stateTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  // Already attempted state styles
  alreadyAttemptedIcon: {
    width: 88,
    height: 88,
    borderRadius: RADIUS["2xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  attemptedDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  attemptedDateText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Success state styles
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: RADIUS["2xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  rewardBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  // Keyboard accessory styles for iOS
  keyboardAccessory: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    borderTopWidth: BORDER_WIDTH.hairline,
  },
  keyboardDismissButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  keyboardDismissText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default SurveyAttemptScreen;
