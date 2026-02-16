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
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Hash,
  ListChecks,
  Lock,
  MessageCircle,
  RefreshCw,
  Shield,
  Star,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { PrimaryButton } from "@/components";
import { formatCurrency, formatDuration } from "@/services";
import { useCheckSurveyAttempt, useSubmitSurvey, useSurvey } from "@/services/hooks";
import { useSurveyAttemptStore } from "@/store/SurveyAttemptStore";
import { useShallow } from "zustand/react/shallow";
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

type QuestionType =
  | "rating"
  | "checkbox"
  | "radio"
  | "text"
  | "paragraph"
  | "dropdown"
  | "boolean"
  | "date"
  | "time"
  | "number";

type AnswerValue = string | number | string[];

interface ParsedOption {
  id: string;
  text: string;
}

interface BooleanLabels {
  yesLabel: string;
  noLabel: string;
}

interface NumberConstraints {
  min?: number | null;
  max?: number | null;
}

interface SurveyQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: ParsedOption[];
  maxRating?: number;
  placeholder?: string | null;
  booleanLabels?: BooleanLabels;
  numberConstraints?: NumberConstraints;
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

const getBooleanLabels = (question: UploadSurvey): BooleanLabels => {
  try {
    const parsed = JSON.parse(question.options || "{}");
    if (parsed && typeof parsed === "object") {
      return {
        yesLabel: (parsed as { yesLabel?: string }).yesLabel || "Yes",
        noLabel: (parsed as { noLabel?: string }).noLabel || "No",
      };
    }
  } catch {
    // ignore
  }
  return { yesLabel: "Yes", noLabel: "No" };
};

const getNumberConstraints = (question: UploadSurvey): NumberConstraints => {
  const constraints: NumberConstraints = {
    min: question.minValue ?? null,
    max: question.maxValue ?? null,
  };
  try {
    const parsed = JSON.parse(question.options || "{}");
    if (parsed && typeof parsed === "object") {
      if ((parsed as { min?: number }).min != null) constraints.min = (parsed as { min: number }).min;
      if ((parsed as { max?: number }).max != null) constraints.max = (parsed as { max: number }).max;
    }
  } catch {
    // ignore
  }
  return constraints;
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
  // ── State via useShallow (grouped, re-render safe) ──
  const { currentQuestionIndex, answers, submissionStatus, submittedReward } = useSurveyAttemptStore(
    useShallow((s) => ({
      currentQuestionIndex: s.currentQuestionIndex,
      answers: s.answers,
      submissionStatus: s.submissionStatus,
      submittedReward: s.submittedReward,
    }))
  );
  // ── Actions (stable references — no useShallow needed) ──
  const storeStartAttempt = useSurveyAttemptStore((s) => s.startAttempt);
  const storeAbandonAttempt = useSurveyAttemptStore((s) => s.abandonAttempt);
  const storeSetAnswer = useSurveyAttemptStore((s) => s.setAnswer);
  const storeGoNext = useSurveyAttemptStore((s) => s.goNext);
  const storeGoPrevious = useSurveyAttemptStore((s) => s.goPrevious);
  const storeSetSubmitting = useSurveyAttemptStore((s) => s.setSubmitting);
  const storeSetSubmitted = useSurveyAttemptStore((s) => s.setSubmitted);
  const storeSetSubmissionError = useSurveyAttemptStore((s) => s.setSubmissionError);
  const storeResetSubmission = useSurveyAttemptStore((s) => s.resetSubmission);
  const storeReset = useSurveyAttemptStore((s) => s.reset);
  const storeSetCurrentIndex = useSurveyAttemptStore((s) => s.setCurrentIndex);

  // Local UI state
  const [showReview, setShowReview] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDropdownModal, setShowDropdownModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
        storeStartAttempt(id, totalQ);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyData, id, attemptStatus?.hasAttempted]);

  // Clean up on unmount — save draft if not submitted
  useEffect(() => {
    return () => {
      if (useSurveyAttemptStore.getState().submissionStatus !== 'submitted') {
        storeAbandonAttempt();
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
        required: q.required ?? true,
        options: parseQuestionOptions(q),
        maxRating: getMaxRating(q),
        placeholder: q.placeholder,
        booleanLabels: q.type === "boolean" ? getBooleanLabels(q) : undefined,
        numberConstraints: q.type === "number" ? getNumberConstraints(q) : undefined,
      })),
    };
  }, [surveyData]);

  const question = survey?.questions[currentQuestionIndex];
  const isLastQuestion = survey ? currentQuestionIndex === survey.questions.length - 1 : false;
  const progress = survey ? ((currentQuestionIndex + 1) / survey.questions.length) * 100 : 0;

  const getDefaultValue = (type: QuestionType): AnswerValue => {
    switch (type) {
      case "rating":
        return 0;
      case "checkbox":
        return [];
      case "radio":
      case "text":
      case "paragraph":
      case "dropdown":
      case "boolean":
      case "date":
      case "time":
      case "number":
      default:
        return "";
    }
  };

  const currentAnswer = question ? answers[question.id] ?? getDefaultValue(question.type) : "";

  const isAnswerValid = (type: QuestionType, answer: AnswerValue): boolean => {
    switch (type) {
      case "rating":
        return typeof answer === "number" && answer > 0;
      case "checkbox":
        return Array.isArray(answer) && answer.length > 0;
      case "radio":
      case "dropdown":
      case "boolean":
        return typeof answer === "string" && answer.length > 0;
      case "text":
      case "paragraph":
        return typeof answer === "string" && answer.trim().length > 0;
      case "date":
      case "time":
        return typeof answer === "string" && answer.length > 0;
      case "number":
        return typeof answer === "string" && answer.trim().length > 0 && !isNaN(Number(answer));
      default:
        return false;
    }
  };

  const isQuestionAnswered = (): boolean => {
    if (!question) return false;
    return isAnswerValid(question.type, currentAnswer);
  };

  const answeredCount = survey?.questions.reduce((count, q) => {
    const value = answers[q.id];
    if (value === undefined || value === null) return count;
    return isAnswerValid(q.type, value) ? count + 1 : count;
  }, 0) || 0;

  // Use store's setAnswer for auto-save
  const setAnswer = (value: AnswerValue): void => {
    if (!question) return;
    storeSetAnswer(question.id, value);
  };

  const handleNext = (): void => {
    if (!question || (question.required && !isQuestionAnswered())) return;

    // Haptic feedback on navigation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (isLastQuestion) {
      openReviewModal();
    } else {
      storeGoNext();
    }
  };

  const handlePrevious = (): void => {
    if (currentQuestionIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      storeGoPrevious();
    }
  };

  const handleSubmit = (): void => {
    if (!survey || !userId) {
      Alert.alert("Error", "You must be logged in to submit a survey.");
      return;
    }

    // Guard against double-submit
    if (submissionStatus === 'submitting' || submissionStatus === 'submitted') {
      return;
    }

    // Validate all required questions are answered
    const unanswered = survey.questions.filter(q => {
      if (!q.required) return false;
      const val = answers[q.id];
      if (val === undefined || val === null || val === '') return true;
      return !isAnswerValid(q.type, val);
    });

    if (unanswered.length > 0) {
      const firstIdx = survey.questions.findIndex(q => q.id === unanswered[0].id);
      Alert.alert(
        "Incomplete Survey",
        `${unanswered.length} required question(s) need an answer. Tap OK to go to the first unanswered question.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "OK", onPress: () => { if (firstIdx >= 0) storeSetCurrentIndex(firstIdx); } },
        ]
      );
      return;
    }

    storeSetSubmitting();

    submitSurveyMutation.mutate(
      { surveyId: survey.id, responses: answers },
      {
        onSuccess: (data) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          storeSetSubmitted(data.reward || 0);
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
            storeSetSubmissionError(message);
            closeReviewModal();
            Alert.alert(
              "Already Completed",
              "You have already completed this survey. Only one attempt per user is allowed.",
              [{ text: "OK", onPress: () => router.back() }]
            );
          } else {
            storeSetSubmissionError(message);
            Alert.alert("Submission Failed", message, [
              { text: "Try Again", onPress: () => storeResetSubmission() },
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
  }, [currentQuestionIndex, slideAnim, isReducedMotion]);

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
        {(submittedReward ?? 0) > 0 && (
          <View style={[styles.rewardBadge, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
            <CheckCircle2 size={18} color={colors.primary} strokeWidth={1.5} />
            <Text style={[styles.rewardBadgeText, { color: colors.primary }]}>
              You earned {formatCurrency(submittedReward || 0)}!
            </Text>
          </View>
        )}
        <PrimaryButton
          title="Back to Surveys"
          onPress={() => {
            storeReset();
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
            isSelected && SHADOWS.sm,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setAnswer(option.id);
          }}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={option.text}
          accessibilityHint={isSelected ? 'Selected' : 'Double tap to select'}
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
          accessibilityLabel={option.text}
          accessibilityHint={selected ? 'Checked. Double tap to uncheck' : 'Double tap to check'}
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

      case "dropdown": {
        const selectedOption = (question.options || []).find(o => o.id === currentAnswer);
        return (
          <View>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                {
                  backgroundColor: colors.card,
                  borderColor: selectedOption ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowDropdownModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select option for: ${question.text}`}
              accessibilityHint={selectedOption ? `Selected: ${selectedOption.text}` : "Double tap to open options"}
            >
              <Text
                style={[
                  styles.dropdownText,
                  { color: selectedOption ? colors.text : colors.textMuted },
                ]}
              >
                {selectedOption ? selectedOption.text : (question.placeholder || "Select an option")}
              </Text>
              <ChevronDown size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Modal visible={showDropdownModal} transparent animationType="fade">
              <TouchableOpacity
                style={styles.dropdownOverlay}
                activeOpacity={1}
                onPress={() => setShowDropdownModal(false)}
              >
                <View style={[styles.dropdownSheet, { backgroundColor: colors.card }]}>
                  <View style={styles.dropdownHeader}>
                    <Text style={[styles.dropdownTitle, { color: colors.text }]}>Select an option</Text>
                    <TouchableOpacity
                      onPress={() => setShowDropdownModal(false)}
                      style={styles.dropdownClose}
                      accessibilityLabel="Close dropdown"
                    >
                      <X size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={styles.dropdownList}>
                    {(question.options || []).map(opt => {
                      const isSelected = currentAnswer === opt.id;
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.dropdownItem,
                            { borderBottomColor: colors.border },
                            isSelected && { backgroundColor: withAlpha(colors.primary, 0.1) },
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setAnswer(opt.id);
                            setShowDropdownModal(false);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.text }]}>{opt.text}</Text>
                          {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
        );
      }

      case "boolean": {
        const labels = question.booleanLabels || { yesLabel: "Yes", noLabel: "No" };
        const value = typeof currentAnswer === "string" ? currentAnswer : "";
        return (
          <View style={styles.booleanRow}>
            <TouchableOpacity
              style={[
                styles.booleanButton,
                {
                  borderColor: value === "true" ? colors.primary : colors.border,
                  backgroundColor: value === "true" ? withAlpha(colors.primary, 0.12) : colors.card,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setAnswer("true");
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === "true" }}
              accessibilityLabel={labels.yesLabel}
            >
              <ToggleRight
                size={24}
                color={value === "true" ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.booleanLabel, { color: value === "true" ? colors.primary : colors.text }]}>
                {labels.yesLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.booleanButton,
                {
                  borderColor: value === "false" ? colors.primary : colors.border,
                  backgroundColor: value === "false" ? withAlpha(colors.primary, 0.12) : colors.card,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setAnswer("false");
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === "false" }}
              accessibilityLabel={labels.noLabel}
            >
              <ToggleLeft
                size={24}
                color={value === "false" ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.booleanLabel, { color: value === "false" ? colors.primary : colors.text }]}>
                {labels.noLabel}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      case "date": {
        const dateValue = typeof currentAnswer === "string" && currentAnswer ? new Date(currentAnswer) : new Date();
        const hasValue = typeof currentAnswer === "string" && currentAnswer.length > 0;
        return (
          <View>
            <TouchableOpacity
              style={[
                styles.dateTimeTrigger,
                {
                  backgroundColor: colors.card,
                  borderColor: hasValue ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowDatePicker(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Pick date for: ${question.text}`}
              accessibilityHint={hasValue ? `Selected: ${currentAnswer}` : "Double tap to pick a date"}
            >
              <Calendar size={20} color={hasValue ? colors.primary : colors.textMuted} />
              <Text style={[styles.dateTimeText, { color: hasValue ? colors.text : colors.textMuted }]}>
                {hasValue ? new Date(currentAnswer as string).toLocaleDateString() : (question.placeholder || "Select a date")}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateValue}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event: DateTimePickerEvent, selectedDate?: Date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setAnswer(selectedDate.toISOString().split("T")[0]);
                  }
                }}
              />
            )}
          </View>
        );
      }

      case "time": {
        const timeValue = typeof currentAnswer === "string" && currentAnswer
          ? (() => { const [h, m] = currentAnswer.split(":"); const d = new Date(); d.setHours(Number(h), Number(m)); return d; })()
          : new Date();
        const hasValue = typeof currentAnswer === "string" && currentAnswer.length > 0;
        return (
          <View>
            <TouchableOpacity
              style={[
                styles.dateTimeTrigger,
                {
                  backgroundColor: colors.card,
                  borderColor: hasValue ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowTimePicker(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Pick time for: ${question.text}`}
              accessibilityHint={hasValue ? `Selected: ${currentAnswer}` : "Double tap to pick a time"}
            >
              <Clock size={20} color={hasValue ? colors.primary : colors.textMuted} />
              <Text style={[styles.dateTimeText, { color: hasValue ? colors.text : colors.textMuted }]}>
                {hasValue ? (currentAnswer as string) : (question.placeholder || "Select a time")}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={timeValue}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event: DateTimePickerEvent, selectedTime?: Date) => {
                  setShowTimePicker(Platform.OS === "ios");
                  if (selectedTime) {
                    const h = String(selectedTime.getHours()).padStart(2, "0");
                    const m = String(selectedTime.getMinutes()).padStart(2, "0");
                    setAnswer(`${h}:${m}`);
                  }
                }}
              />
            )}
          </View>
        );
      }

      case "number": {
        const constraints = question.numberConstraints || {};
        const numValue = typeof currentAnswer === "string" ? currentAnswer : "";
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
                  minHeight: 52,
                },
              ]}
              placeholder={question.placeholder || "Enter a number"}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={numValue}
              onChangeText={(text) => {
                // Allow only numeric input (digits, minus, decimal)
                const cleaned = text.replace(/[^0-9.\-]/g, "");
                setAnswer(cleaned);
              }}
              accessibilityLabel={`Number input for: ${question.text}`}
              accessibilityHint={
                constraints.min != null && constraints.max != null
                  ? `Enter a number between ${constraints.min} and ${constraints.max}`
                  : "Enter a numeric value"
              }
              inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_VIEW_ID : undefined}
              returnKeyType="done"
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: !isReducedMotion });
                }, 150);
              }}
            />
            {(constraints.min != null || constraints.max != null) && (
              <View style={styles.helperRow}>
                <Hash size={16} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  {constraints.min != null && constraints.max != null
                    ? `Range: ${constraints.min} – ${constraints.max}`
                    : constraints.min != null
                      ? `Minimum: ${constraints.min}`
                      : `Maximum: ${constraints.max}`}
                </Text>
              </View>
            )}
          </View>
        );
      }

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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setAnswer(level);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${level} of ${max} stars`}
                  accessibilityHint={active ? 'Currently selected' : 'Double tap to rate'}
                  style={styles.ratingStar}
                  activeOpacity={0.7}
                >
                  <Star
                    size={32}
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

      case "paragraph":
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
                  minHeight: 160,
                },
              ]}
              placeholder={question.placeholder || "Write your detailed response..."}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={typeof currentAnswer === "string" ? currentAnswer : ""}
              onChangeText={(text) => setAnswer(text)}
              accessibilityLabel={`Long answer for: ${question.text}`}
              accessibilityHint="Enter your detailed text response"
              inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_VIEW_ID : undefined}
              returnKeyType="done"
              blurOnSubmit={false}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: !isReducedMotion });
                }, 150);
              }}
            />
            <View style={styles.helperRow}>
              <MessageCircle size={16} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Share as much detail as you'd like.
              </Text>
            </View>
          </View>
        );

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
              accessibilityLabel={`Answer for: ${question.text}`}
              accessibilityHint="Enter your text response"
              inputAccessoryViewID={Platform.OS === 'ios' ? INPUT_ACCESSORY_VIEW_ID : undefined}
              returnKeyType="done"
              blurOnSubmit={false}
              onFocus={() => {
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
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Question {currentQuestionIndex + 1} of {survey.questions.length}</Text>
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
                onPress={() => storeSetCurrentIndex(idx)}
                style={[
                  styles.stepChip,
                  {
                    borderColor: idx === currentQuestionIndex ? colors.primary : colors.border,
                    backgroundColor: idx === currentQuestionIndex ? withAlpha(colors.primary, 0.16) : colors.card,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Go to question ${idx + 1}`}
              >
                <Text style={[styles.stepNumber, { color: idx === currentQuestionIndex ? colors.primary : colors.text }]}>
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
              <Text style={[styles.questionBadgeText, { color: colors.primary }]}>Question {currentQuestionIndex + 1}</Text>
            </View>
            {question?.required && (
              <View style={[styles.requiredPill, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
                <Text style={[styles.requiredText, { color: colors.error }]}>Required</Text>
              </View>
            )}
          </View>

          <Text style={[styles.questionTitle, { color: colors.text }]}>{question?.text}</Text>
          {question && !question.required && (
            <Text style={[styles.optionalBadge, { color: colors.textMuted }]}>(Optional)</Text>
          )}
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
        {currentQuestionIndex > 0 && (
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
          disabled={(question?.required && !isQuestionAnswered()) || submissionStatus === 'submitting'}
          loading={submissionStatus === 'submitting' && isLastQuestion}
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
                <Text style={[styles.modalStatText, { color: colors.text }]}>Estimated time left ~ {formatDuration(Math.max(survey.questions.length - currentQuestionIndex - 1, 0) * 2)}</Text>
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
                loading={submissionStatus === 'submitting'}
                disabled={submissionStatus === 'submitting'}
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
    width: 44,
    height: 44,
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
    letterSpacing: -0.3,
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
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.hairline,
    ...SHADOWS.sm,
  },
  progressTrack: {
    height: 10,
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
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
  },
  stepNumber: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  stepStatus: {
    width: 20,
    height: 6,
    borderRadius: RADIUS.full,
  },
  questionCard: {
    marginHorizontal: SPACING.base,
    padding: SPACING.xl,
    borderRadius: RADIUS['2xl'],
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
    letterSpacing: -0.2,
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
    gap: SPACING.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 52,
  },
  optionText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: BORDER_WIDTH.base,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
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
    padding: SPACING.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  textFieldWrapper: {
    gap: SPACING.sm,
  },
  textInput: {
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    minHeight: 130,
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
    paddingTop: SPACING.md,
    borderTopWidth: BORDER_WIDTH.hairline,
    ...SHADOWS.lg,
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
    borderRadius: RADIUS['2xl'],
    padding: SPACING.xl,
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
    letterSpacing: -0.2,
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
    letterSpacing: -0.2,
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
  // Optional badge
  optionalBadge: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: "italic",
    marginBottom: SPACING.xs,
  },
  // Dropdown styles
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 52,
  },
  dropdownText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: withAlpha("#000000", 0.5),
    justifyContent: "flex-end",
  },
  dropdownSheet: {
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    maxHeight: "60%",
    ...SHADOWS.lg,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.base,
    borderBottomWidth: BORDER_WIDTH.hairline,
  },
  dropdownTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  dropdownClose: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownList: {
    paddingHorizontal: SPACING.base,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.hairline,
    minHeight: 52,
  },
  dropdownItemText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
  },
  // Boolean styles
  booleanRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  booleanButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 64,
  },
  booleanLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  // Date/Time trigger styles
  dateTimeTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: BORDER_WIDTH.thin,
    minHeight: 52,
  },
  dateTimeText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    flex: 1,
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
