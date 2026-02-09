import { formatCurrency, formatDate } from "@/services/api";
import { useQuestion, useSubmitResponse } from "@/services/hooks";
import { Response } from "@/types";
import {
    BORDER_WIDTH,
    COMPONENT_SIZE,
    ICON_SIZE,
    RADIUS,
    SPACING,
    TYPOGRAPHY,
    ThemeColors,
    useTheme
} from "@/utils/theme";
import { useFormValidation, validators } from "@/utils/validation";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useReducedMotion } from "@/utils/accessibility";
import { useToast } from "@/components/ui/Toast";
import { AnswerQuestionSkeleton } from "@/components/question/QuestionSkeletons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    ArrowLeft,
    Award,
    CheckCircle2,
    MessageSquare,
    RefreshCw,
    Send,
    ThumbsUp,
} from "lucide-react-native";
import React, { memo, useCallback, useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

const AnswerCard = memo<AnswerCardProps & { index: number; reduceMotion: boolean }>(({ answer, colors, index, reduceMotion }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLikePress = useCallback(() => {
    triggerHaptic('light');
    if (!reduceMotion) {
      scale.value = withSpring(1.05, { damping: 10 }, () => {
        scale.value = withSpring(1);
      });
    }
  }, [reduceMotion]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(index * 60).springify().damping(14)}
      style={[styles.answerCard, { backgroundColor: colors.card }]}
    >
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
            <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
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
        <AnimatedPressable
          style={[styles.likeButton, animatedStyle]}
          onPress={handleLikePress}
          accessibilityRole="button"
          accessibilityLabel={`Like answer, ${answer.likesCount || 0} likes`}
          accessibilityHint="Double tap to like this answer"
          hitSlop={8}
        >
          <ThumbsUp size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={[styles.likeCount, { color: colors.textMuted }]}>
            {answer.likesCount || 0}
          </Text>
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
});

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
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();

  // Fetch question data using the API hook
  const { data: questionData, isLoading: questionLoading, error: questionError, refetch } = useQuestion(id || "1");
  const submitResponse = useSubmitResponse();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    triggerHaptic('light');
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
      triggerHaptic('warning');
      return;
    }

    triggerHaptic('medium');
    submitResponse.mutate(
      { questionId: question.id, responseText: form.values.answer },
      {
        onSuccess: () => {
          setSubmitted(true);
          triggerHaptic('success');
          showToast({
            message: `Answer submitted! You earned ${formatCurrency(question.rewardAmount)}!`,
            type: 'success',
            duration: 4000,
            action: 'Go Back',
            onAction: () => router.back(),
          });
        },
        onError: () => {
          triggerHaptic('error');
          showToast({
            message: 'Failed to submit answer. Please try again.',
            type: 'error',
            action: 'Retry',
            onAction: handleSubmit,
          });
        },
      }
    );
  };

  const handleBack = (): void => {
    router.back();
  };

  const handleOpenDiscussion = (): void => {
    if (!question) return;
    router.push({ pathname: "/question-detail", params: { id: question.id } });
  };

  // Loading state — skeleton shimmer
  if (questionLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <AnswerQuestionSkeleton />
      </View>
    );
  }

  // Error state with retry
  if (questionError || !question) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Failed to load question</Text>
        <View style={styles.errorActions}>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => { triggerHaptic('light'); refetch(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading question"
          >
            <RefreshCw size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={2} />
            <Text style={[styles.backButtonErrorText, { color: colors.primaryText }]}>Retry</Text>
          </Pressable>
          <Pressable
            style={[styles.backButtonError, { borderColor: colors.border }]}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.backButtonErrorText, { color: colors.text }]}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderAnswerItem = ({ item, index }: { item: Answer; index: number }) => (
    <AnswerCard answer={item} colors={colors} index={index} reduceMotion={reduceMotion} />
  );

  const answersKeyExtractor = (item: Answer) => item.id;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          onPress={() => { triggerHaptic('light'); handleBack(); }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
          hitSlop={8}
        >
          <ArrowLeft size={ICON_SIZE.lg} color={colors.text} strokeWidth={1.5} />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Answer Question
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Earn {formatCurrency(question.rewardAmount)}
          </Text>
        </View>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.scrollView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + COMPONENT_SIZE.touchTarget}
      >
      <FlatList
        data={question.answers}
        renderItem={renderAnswerItem}
        keyExtractor={answersKeyExtractor}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + COMPONENT_SIZE.input.large + COMPONENT_SIZE.touchTarget },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        maxToRenderPerBatch={8}
        windowSize={5}
        ListHeaderComponent={
          <>
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
                <Award size={ICON_SIZE.xs} color={colors.primaryText} strokeWidth={1.5} />
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
              <MessageSquare size={ICON_SIZE.md} color={colors.textMuted} strokeWidth={1.5} />
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

        {/* Previous Answers Header */}
        {question.answers.length > 0 && (
          <View style={styles.answersSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Previous Answers ({question.answers.length})
            </Text>
          </View>
        )}
        </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageSquare size={ICON_SIZE['4xl']} color={colors.textMuted} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No answers yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Be the first to answer this question!
            </Text>
          </View>
        }
      />
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View
        style={[
          styles.submitContainer,
          {
            paddingBottom: insets.bottom + SPACING.base,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: submitted ? colors.success : colors.primary },
            (submitResponse.isPending || submitted) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitResponse.isPending || submitted}
          accessibilityRole="button"
          accessibilityLabel="Submit answer"
          accessibilityHint="Submits your answer to this question"
          accessibilityState={{ disabled: submitResponse.isPending || submitted }}
        >
          {submitResponse.isPending ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>Submitting…</Text>
            </Animated.View>
          ) : (
            <>
              <Send size={ICON_SIZE.lg} color={colors.primaryText} strokeWidth={1.5} />
              <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
                {submitted ? "Submitted!" : "Submit Answer"}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={[styles.viewDiscussionButton, { borderColor: colors.primary }]}
          onPress={() => { triggerHaptic('light'); handleOpenDiscussion(); }}
          accessibilityRole="button"
          accessibilityLabel="Open discussion"
          accessibilityHint="Opens the full discussion thread for this question"
        >
          <Text style={[styles.viewDiscussionText, { color: colors.primary }]}>View discussion</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.base,
    borderBottomWidth: BORDER_WIDTH.thin,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  backButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginTop: SPACING.xxs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.base,
  },
  questionCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.base,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  categoryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.base,
  },
  questionMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.base,
  },
  authorAvatar: {
    width: COMPONENT_SIZE.avatar.sm,
    height: COMPONENT_SIZE.avatar.sm,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  authorAvatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  authorName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  dotSeparator: {
    marginHorizontal: SPACING.sm,
  },
  questionDate: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  statsRow: {
    paddingTop: SPACING.md,
    borderTopWidth: BORDER_WIDTH.thin,
    flexDirection: "row",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  answerInputCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.md,
  },
  answerInput: {
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.body,
    minHeight: 150,
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  charCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  inputError: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  answersSection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    marginBottom: SPACING.base,
  },
  answerCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  answerAvatar: {
    width: COMPONENT_SIZE.avatar.sm + 4,
    height: COMPONENT_SIZE.avatar.sm + 4,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  answerAvatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: "#FFFFFF",
  },
  answerUserInfo: {
    flex: 1,
  },
  answerUserName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  answerDate: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  acceptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: SPACING.xs,
  },
  acceptedText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
  },
  answerText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.body,
    lineHeight: TYPOGRAPHY.fontSize.body * TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.md,
  },
  answerFooter: {
    flexDirection: "row",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  likeCount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  submitContainer: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    borderTopWidth: BORDER_WIDTH.thin,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.base - 2,
    borderRadius: RADIUS.base,
  },
  submitButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  viewDiscussionButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.base,
    borderWidth: BORDER_WIDTH.thin,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
  },
  viewDiscussionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.md,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.base,
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  backButtonError: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
  },
  backButtonErrorText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING['3xl'],
    gap: SPACING.md,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.body,
    textAlign: "center",
  },
});
