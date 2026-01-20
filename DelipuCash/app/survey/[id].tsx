import React, { useState, memo, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Award,
  Clock,
  CheckCircle2,
  ChevronRight,
  Star,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import {
  useTheme,
  ThemeColors,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  COMPONENT_SIZE,
  BORDER_WIDTH,
} from "@/utils/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useSurvey, useSubmitSurvey } from "@/services/hooks";
import { formatCurrency, formatDuration } from "@/data/mockData";
import { UploadSurvey } from "@/types";

type QuestionType = "rating" | "checkbox" | "radio" | "text";

interface ParsedOption {
  id: string;
  text: string;
}

interface SurveyQuestionDisplay {
  id: string;
  questionText: string;
  questionType: QuestionType;
  required: boolean;
  options?: ParsedOption[];
  maxRating?: number;
}

interface SurveyDisplay {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  estimatedTime: number;
  questions: SurveyQuestionDisplay[];
}

type AnswerValue = string | number | string[];

interface RatingQuestionProps {
  question: SurveyQuestionDisplay;
  value: number;
  onChange: (value: number) => void;
  colors: ThemeColors;
}

const RatingQuestion = memo<RatingQuestionProps>(
  ({ question, value, onChange, colors }) => (
    <View style={styles.questionContent}>
      <View style={styles.ratingContainer}>
        {Array.from({ length: question.maxRating || 5 }).map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onChange(index + 1)}
            style={styles.starButton}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${index + 1} stars`}
          >
            <Star
              size={36}
              color={value >= index + 1 ? colors.warning : colors.textMuted}
              fill={value >= index + 1 ? colors.warning : "transparent"}
              strokeWidth={1.5}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>
        {value > 0 ? `${value} out of ${question.maxRating || 5}` : "Tap to rate"}
      </Text>
    </View>
  )
);

RatingQuestion.displayName = "RatingQuestion";

interface CheckboxQuestionProps {
  question: SurveyQuestionDisplay;
  value: string[];
  onChange: (value: string[]) => void;
  colors: ThemeColors;
}

const CheckboxQuestion = memo<CheckboxQuestionProps>(
  ({ question, value, onChange, colors }) => {
    const toggleOption = (optionId: string): void => {
      const isSelected = value.includes(optionId);
      if (isSelected) {
        onChange(value.filter((id) => id !== optionId));
      } else {
        onChange([...value, optionId]);
      }
    };

    return (
      <View style={styles.questionContent}>
        {question.options?.map((option) => {
          const isSelected = value.includes(option.id);
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected
                    ? `${colors.primary}15`
                    : colors.secondary,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleOption(option.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.textMuted,
                    backgroundColor: isSelected ? colors.primary : "transparent",
                  },
                ]}
              >
                {isSelected && (
                  <CheckCircle2 size={14} color={colors.primaryText} strokeWidth={2} />
                )}
              </View>
              <Text
                style={[
                  styles.optionText,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
              >
                {option.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
);

CheckboxQuestion.displayName = "CheckboxQuestion";

interface RadioQuestionProps {
  question: SurveyQuestionDisplay;
  value: string | null;
  onChange: (value: string) => void;
  colors: ThemeColors;
}

const RadioQuestion = memo<RadioQuestionProps>(
  ({ question, value, onChange, colors }) => (
    <View style={styles.questionContent}>
      {question.options?.map((option) => {
        const isSelected = value === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionButton,
              {
                backgroundColor: isSelected
                  ? `${colors.primary}15`
                  : colors.secondary,
                borderColor: isSelected ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onChange(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
          >
            <View
              style={[
                styles.radioButton,
                {
                  borderColor: isSelected ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {isSelected && (
                <View
                  style={[styles.radioInner, { backgroundColor: colors.primary }]}
                />
              )}
            </View>
            <Text
              style={[
                styles.optionText,
                { color: isSelected ? colors.primary : colors.text },
              ]}
            >
              {option.text}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  )
);

RadioQuestion.displayName = "RadioQuestion";

interface TextQuestionProps {
  question: SurveyQuestionDisplay;
  value: string;
  onChange: (value: string) => void;
  colors: ThemeColors;
}

const TextQuestion = memo<TextQuestionProps>(
  ({ question, value, onChange, colors }) => (
    <View style={styles.questionContent}>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder="Type your answer here..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        value={value}
        onChangeText={onChange}
      />
    </View>
  )
);

TextQuestion.displayName = "TextQuestion";

// Helper function to parse question options from UploadSurvey
const parseQuestionOptions = (question: UploadSurvey): ParsedOption[] => {
  try {
    const parsed = JSON.parse(question.options);
    if (Array.isArray(parsed)) {
      // Simple array of strings
      return parsed.map((text, index) => ({ id: `opt_${index}`, text: String(text) }));
    } else if (parsed && typeof parsed === "object" && parsed.labels) {
      // Rating with labels
      return parsed.labels.map((text: string, index: number) => ({ id: `opt_${index}`, text }));
    }
    return [];
  } catch {
    return [];
  }
};

// Helper to get max rating from question
const getMaxRating = (question: UploadSurvey): number => {
  if (question.maxValue) return question.maxValue;
  try {
    const parsed = JSON.parse(question.options);
    if (parsed && parsed.max) return parsed.max;
    if (parsed && parsed.labels) return parsed.labels.length;
  } catch {
    // ignore
  }
  return 5;
};

/**
 * Survey completion screen component
 * Multi-step survey with various question types
 */
export default function SurveyScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  // Fetch survey data using the API hook
  const { data: surveyData, isLoading: surveyLoading, error: surveyError } = useSurvey(id || "1");
  const submitSurvey = useSubmitSurvey();

  // Transform survey data for display
  const survey: SurveyDisplay | null = useMemo(() => {
    if (!surveyData) return null;
    return {
      id: surveyData.id,
      title: surveyData.title,
      description: surveyData.description || "",
      rewardAmount: surveyData.rewardAmount || 0,
      estimatedTime: (surveyData.questions?.length || 0) * 2, // Estimate 2 mins per question
      questions: (surveyData.questions || []).map((q: UploadSurvey) => ({
        id: q.id,
        questionText: q.text,
        questionType: q.type as QuestionType,
        required: true, // All questions required by default
        options: parseQuestionOptions(q),
        maxRating: getMaxRating(q),
      })),
    };
  }, [surveyData]);

  const question = survey?.questions[currentQuestion];
  const isLastQuestion = survey ? currentQuestion === survey.questions.length - 1 : false;
  const progress = survey ? ((currentQuestion + 1) / survey.questions.length) * 100 : 0;

  const getDefaultValue = (type: QuestionType): AnswerValue => {
    switch (type) {
      case "rating":
        return 0;
      case "checkbox":
        return [];
      case "radio":
        return "";
      case "text":
        return "";
      default:
        return "";
    }
  };

  const currentAnswer = question ? (answers[question.id] ?? getDefaultValue(question.questionType)) : "";

  const setAnswer = (value: AnswerValue): void => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
  };

  const isQuestionAnswered = (): boolean => {
    const answer = currentAnswer;
    switch (question?.questionType) {
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

  const canProceed = !question?.required || isQuestionAnswered();

  const handleNext = (): void => {
    if (!canProceed) return;

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePrevious = (): void => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  const handleSubmit = (): void => {
    if (!survey) return;

    submitSurvey.mutate(
      { surveyId: survey.id, responses: answers },
      {
        onSuccess: (data) => {
          Alert.alert(
            "Survey Completed!",
            `Thank you for completing this survey. You earned ${formatCurrency(data.reward)}!`,
            [{ text: "OK", onPress: () => router.back() }]
          );
        },
        onError: () => {
          Alert.alert("Error", "Failed to submit survey. Please try again.");
        },
      }
    );
  };

  const handleBack = (): void => {
    router.back();
  };

  const renderQuestion = (): React.ReactNode => {
    if (!question) return null;
    switch (question.questionType) {
      case "rating":
        return (
          <RatingQuestion
            question={question}
            value={currentAnswer as number}
            onChange={(value) => setAnswer(value)}
            colors={colors}
          />
        );
      case "checkbox":
        return (
          <CheckboxQuestion
            question={question}
            value={currentAnswer as string[]}
            onChange={(value) => setAnswer(value)}
            colors={colors}
          />
        );
      case "radio":
        return (
          <RadioQuestion
            question={question}
            value={(currentAnswer as string) || null}
            onChange={(value) => setAnswer(value)}
            colors={colors}
          />
        );
      case "text":
        return (
          <TextQuestion
            question={question}
            value={currentAnswer as string}
            onChange={(value) => setAnswer(value)}
            colors={colors}
          />
        );
      default:
        return null;
    }
  };

  // Loading state
  if (surveyLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading survey...</Text>
      </View>
    );
  }

  // Error state
  if (surveyError || !survey || survey.questions.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Failed to load survey</Text>
        <TouchableOpacity
          style={[styles.backButtonError, { backgroundColor: colors.primary }]}
          onPress={handleBack}
          accessibilityRole="button"
        >
          <Text style={[styles.backButtonErrorText, { color: colors.primaryText }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {survey.title}
          </Text>
          <View style={styles.headerMeta}>
            <Award size={14} color={colors.primary} strokeWidth={1.5} />
            <Text style={[styles.headerReward, { color: colors.primary }]}>
              {formatCurrency(survey.rewardAmount)}
            </Text>
            <View style={styles.metaDivider} />
            <Clock size={14} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.headerDuration, { color: colors.textMuted }]}>
              {formatDuration(survey.estimatedTime)}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressContainer, { backgroundColor: colors.card }]}>
        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress}%` },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          Question {currentQuestion + 1} of {survey.questions.length}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Question Card */}
        <View style={[styles.questionCard, { backgroundColor: colors.card }]}>
          <View style={styles.questionHeader}>
            <Text style={[styles.questionNumber, { color: colors.primary }]}>
              Q{currentQuestion + 1}
            </Text>
            {question?.required && (
              <View style={[styles.requiredBadge, { backgroundColor: `${colors.error}15` }]}>
                <Text style={[styles.requiredText, { color: colors.error }]}>
                  Required
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.questionText, { color: colors.text }]}>
            {question?.questionText}
          </Text>

          {renderQuestion()}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View
        style={[
          styles.navigationContainer,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {currentQuestion > 0 && (
          <TouchableOpacity
            style={[styles.prevButton, { borderColor: colors.border }]}
            onPress={handlePrevious}
            accessibilityRole="button"
            accessibilityLabel="Previous question"
          >
            <ArrowLeft size={18} color={colors.text} strokeWidth={1.5} />
            <Text style={[styles.prevButtonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: canProceed ? colors.primary : colors.secondary,
              flex: currentQuestion === 0 ? 1 : 0,
              marginLeft: currentQuestion > 0 ? 12 : 0,
            },
          ]}
          onPress={handleNext}
          disabled={!canProceed || submitSurvey.isPending}
          accessibilityRole="button"
          accessibilityLabel={isLastQuestion ? "Submit survey" : "Next question"}
        >
          {submitSurvey.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <>
              <Text
                style={[
                  styles.nextButtonText,
                  { color: canProceed ? colors.primaryText : colors.textMuted },
                ]}
              >
                {isLastQuestion ? "Submit" : "Next"}
              </Text>
              {!isLastQuestion && (
                <ChevronRight
                  size={18}
                  color={canProceed ? colors.primaryText : colors.textMuted}
                  strokeWidth={1.5}
                />
              )}
              {isLastQuestion && (
                <CheckCircle2
                  size={18}
                  color={canProceed ? colors.primaryText : colors.textMuted}
                  strokeWidth={1.5}
                />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  headerReward: {
    fontFamily: "Roboto_700Bold",
    fontSize: 13,
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9CA3AF",
    marginHorizontal: 6,
  },
  headerDuration: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  questionCard: {
    borderRadius: 16,
    padding: 20,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  questionNumber: {
    fontFamily: "Roboto_700Bold",
    fontSize: 14,
  },
  requiredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requiredText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 11,
  },
  questionText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 24,
  },
  questionContent: {
    marginTop: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    flex: 1,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    minHeight: 120,
  },
  navigationContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  prevButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  prevButtonText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 15,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 6,
    flex: 1,
  },
  nextButtonText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 16,
    marginBottom: 16,
  },
  backButtonError: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonErrorText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 14,
  },
});
