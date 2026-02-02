import { formatCurrency, formatDate } from "@/services/api";
import { useQuestion, useSubmitResponse } from "@/services/hooks";
import { Response } from "@/types";
import {
    ThemeColors,
    useTheme
} from "@/utils/theme";
import { useFormValidation, validators } from "@/utils/validation";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    ArrowLeft,
    Award,
    CheckCircle2,
    MessageSquare,
    Send,
    ThumbsUp,
} from "lucide-react-native";
import React, { memo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Answer {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  responseText: string;
  likesCount: number;
  isAccepted?: boolean;
  createdAt: string;
}

interface QuestionDisplay {
  id: string;
  text: string;
  category: string;
  rewardAmount: number;
  isInstantReward: boolean;
  user: {
    name: string;
    avatar: string;
  };
  createdAt: string;
  totalAnswers: number;
  answers: Answer[];
}

interface AnswerCardProps {
  answer: Answer;
  colors: ThemeColors;
}

interface FormValues {
  answer: string;
}

interface FormState {
  values: FormValues;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  handleChange: (name: string, value: string) => void;
  handleBlur: (name: string) => void;
}

const AnswerCard = memo<AnswerCardProps>(({ answer, colors }) => (
  <View style={[styles.answerCard, { backgroundColor: colors.card }]}>
    <View style={styles.answerHeader}>
      <View style={[styles.answerAvatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.answerAvatarText}>{answer.user.avatar}</Text>
      </View>
      <View style={styles.answerUserInfo}>
        <Text style={[styles.answerUserName, { color: colors.text }]}>
          {answer.user.name}
        </Text>
        <Text style={[styles.answerDate, { color: colors.textMuted }]}>
          {formatDate(answer.createdAt)}
        </Text>
      </View>
      {answer.isAccepted && (
        <View style={[styles.acceptedBadge, { backgroundColor: `${colors.success}20` }]}>
          <CheckCircle2 size={14} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.acceptedText, { color: colors.success }]}>
            Accepted
          </Text>
        </View>
      )}
    </View>
    <Text style={[styles.answerText, { color: colors.text }]}>
      {answer.responseText}
    </Text>
    <View style={styles.answerFooter}>
      <TouchableOpacity style={styles.likeButton} accessibilityRole="button">
        <ThumbsUp size={16} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.likeCount, { color: colors.textMuted }]}>
          {answer.likesCount || 0}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
));

AnswerCard.displayName = "AnswerCard";

interface FormValues {
  answer: string;
}

/**
 * Answer Question screen component
 * Displays question details and allows users to submit answers
 */
export default function AnswerQuestionScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Fetch question data using the API hook
  const { data: questionData, isLoading: questionLoading, error: questionError } = useQuestion(id || "1");
  const submitResponse = useSubmitResponse();

  const validationSchema = {
    answer: [
      validators.required,
      validators.minLength(10),
      validators.maxLength(500),
    ],
  };

  const form = useFormValidation({ answer: "" }, validationSchema) as FormState;

  // Transform question data for display
  const question: QuestionDisplay | null = React.useMemo(() => {
    if (!questionData) return null;
    // Use user data from API response
    const questionUser = questionData.user;
    const userName = questionUser ? `${questionUser.firstName} ${questionUser.lastName}` : "Anonymous";
    return {
      id: questionData.id,
      text: questionData.text,
      category: questionData.category || "General",
      rewardAmount: questionData.rewardAmount || 0,
      isInstantReward: questionData.isInstantReward || false,
      user: {
        name: userName,
        avatar: userName.charAt(0).toUpperCase(),
      },
      createdAt: questionData.createdAt,
      totalAnswers: questionData.responses?.length || 0,
      answers: (questionData.responses || []).map((r: Response, index: number) => {
        // Use user data from response API response
        const respUser = r.user;
        const respUserName = respUser ? `${respUser.firstName} ${respUser.lastName}` : "Anonymous";
        return {
          id: r.id,
          user: {
            name: respUserName,
            avatar: respUserName.charAt(0).toUpperCase(),
          },
          responseText: r.responseText,
          likesCount: r.likesCount || 0,
          isAccepted: index === 0, // First answer is marked as accepted for demo
          createdAt: r.createdAt,
        };
      }),
    };
  }, [questionData]);

  const handleSubmit = (): void => {
    const isValid = !validationSchema.answer.some((rule) =>
      rule(form.values.answer, "answer")
    );

    if (!isValid || !question) {
      return;
    }

    submitResponse.mutate(
      { questionId: question.id, responseText: form.values.answer },
      {
        onSuccess: () => {
          setSubmitted(true);
          Alert.alert(
            "Success!",
            `Your answer has been submitted. You earned ${formatCurrency(question.rewardAmount)}!`,
            [{ text: "OK", onPress: () => router.back() }]
          );
        },
        onError: () => {
          Alert.alert("Error", "Failed to submit answer. Please try again.");
        },
      }
    );
  };

  const handleBack = (): void => {
    router.back();
  };

  const handleOpenDiscussion = (): void => {
    if (!question) return;
    router.push(`/question-comments/${question.id}`);
  };

  // Loading state
  if (questionLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading question...</Text>
      </View>
    );
  }

  // Error state
  if (questionError || !question) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Failed to load question</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Answer Question
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Earn {formatCurrency(question.rewardAmount)}
          </Text>
        </View>
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
            <View style={[styles.categoryBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.categoryText, { color: colors.textMuted }]}>
                {question.category}
              </Text>
            </View>
            {question.isInstantReward && (
              <View style={[styles.rewardBadge, { backgroundColor: colors.primary }]}>
                <Award size={12} color={colors.primaryText} strokeWidth={1.5} />
                <Text style={[styles.rewardText, { color: colors.primaryText }]}>
                  {formatCurrency(question.rewardAmount)}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.questionText, { color: colors.text }]}>
            {question.text}
          </Text>

          <View style={styles.questionMeta}>
            <View style={[styles.authorAvatar, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.authorAvatarText, { color: colors.text }]}>
                {question.user.avatar}
              </Text>
            </View>
            <Text style={[styles.authorName, { color: colors.textMuted }]}>
              {question.user.name}
            </Text>
            <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
            <Text style={[styles.questionDate, { color: colors.textMuted }]}>
              {formatDate(question.createdAt)}
            </Text>
          </View>

          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statItem}>
              <MessageSquare size={16} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {question.totalAnswers} answers
              </Text>
            </View>
          </View>
        </View>

        {/* Answer Input */}
        <View style={[styles.answerInputCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Your Answer
          </Text>
          <TextInput
            style={[
              styles.answerInput,
              {
                backgroundColor: colors.secondary,
                color: colors.text,
                borderColor:
                  form.errors.answer && form.touched.answer
                    ? colors.error
                    : colors.border,
              },
            ]}
            placeholder="Share your thoughtful answer..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={form.values.answer}
            onChangeText={(value) => form.handleChange("answer", value)}
            onBlur={() => form.handleBlur("answer")}
            editable={!submitted}
          />
          <View style={styles.inputFooter}>
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {form.values.answer.length}/500
            </Text>
            {form.errors.answer && form.touched.answer && (
              <Text style={[styles.inputError, { color: colors.error }]}>
                {form.errors.answer}
              </Text>
            )}
          </View>
        </View>

        {/* Previous Answers */}
        {question.answers.length > 0 && (
          <View style={styles.answersSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Previous Answers ({question.answers.length})
            </Text>
            {question.answers.map((answer) => (
              <AnswerCard key={answer.id} answer={answer} colors={colors} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      <View
        style={[
          styles.submitContainer,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: submitted ? colors.success : colors.primary },
          ]}
          onPress={handleSubmit}
          disabled={submitResponse.isPending || submitted}
          accessibilityRole="button"
          accessibilityLabel="Submit answer"
        >
          {submitResponse.isPending ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <>
              <Send size={20} color={colors.primaryText} strokeWidth={1.5} />
              <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
                {submitted ? "Submitted!" : "Submit Answer"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewDiscussionButton, { borderColor: colors.primary }]}
          onPress={handleOpenDiscussion}
          accessibilityRole="button"
          accessibilityLabel="Open discussion"
        >
          <Text style={[styles.viewDiscussionText, { color: colors.primary }]}>View discussion</Text>
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
  headerSubtitle: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  questionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 12,
  },
  rewardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rewardText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 12,
  },
  questionText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 16,
  },
  questionMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  authorAvatarText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 10,
  },
  authorName: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
  },
  dotSeparator: {
    marginHorizontal: 8,
  },
  questionDate: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
  },
  statsRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 13,
  },
  answerInputCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
    marginBottom: 12,
  },
  answerInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    minHeight: 150,
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  charCount: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
  },
  inputError: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
  },
  answersSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
    marginBottom: 16,
  },
  answerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  answerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  answerAvatarText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  answerUserInfo: {
    flex: 1,
  },
  answerUserName: {
    fontFamily: "Roboto_500Medium",
    fontSize: 14,
  },
  answerDate: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  acceptedText: {
    fontFamily: "Roboto_500Medium",
    fontSize: 11,
  },
  answerText: {
    fontFamily: "Roboto_400Regular",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  answerFooter: {
    flexDirection: "row",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeCount: {
    fontFamily: "Roboto_500Medium",
    fontSize: 13,
  },
  submitContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitButtonText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 16,
  },
  viewDiscussionButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  viewDiscussionText: {
    fontFamily: "Roboto_700Bold",
    fontSize: 14,
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
