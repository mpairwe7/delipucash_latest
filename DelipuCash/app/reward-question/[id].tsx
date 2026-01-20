import { PrimaryButton } from "@/components";
import { formatCurrency } from "@/data/mockData";
import { useRewardQuestion, useSubmitRewardAnswer } from "@/services/hooks";
import { RewardAnswerResult } from "@/types";
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
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    ArrowLeft,
    Award,
    CheckCircle2,
    Clock3,
    Info,
    ShieldCheck,
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Reward question answer screen
 */
export default function RewardQuestionAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<RewardAnswerResult | null>(null);

  const { data: question, isLoading, error } = useRewardQuestion(id || "");
  const submitAnswer = useSubmitRewardAnswer();

  const options = useMemo(() => {
    if (!question?.options) return [] as { key: string; label: string }[];
    return Object.entries(question.options).map(([key, label]) => ({ key, label: String(label) }));
  }, [question]);

  const handleBack = (): void => {
    router.back();
  };

  const handleSubmit = (): void => {
    const answer = selectedOption || "";

    if (!question) return;
    if (!answer) {
      Alert.alert("Choose an answer", "Select the option you think is correct.");
      return;
    }

    submitAnswer.mutate(
      { questionId: question.id, answer },
      {
        onSuccess: (payload) => {
          setResult(payload);
          if (payload.isCorrect) {
            Alert.alert("Correct!", payload.message || "Reward unlocked.");
          } else if (payload.isExpired || payload.isCompleted) {
            Alert.alert("Unavailable", payload.message || "Rewards are no longer available.");
          } else {
            Alert.alert("Try again", payload.message || "That was not correct.");
          }
        },
        onError: () => {
          Alert.alert("Error", "Unable to submit your answer. Please try again.");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading reward question...</Text>
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Reward question not found</Text>
        <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
      </View>
    );
  }

  const isDisabled = Boolean(result?.isCorrect || result?.isExpired || result?.isCompleted);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
        >
          <ArrowLeft size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Reward question</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Answer to unlock instant rewards</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
              <Award size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Instant reward</Text>
            </View>
            {question.expiryTime && (
              <View style={[styles.badge, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
                <Clock3 size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
                <Text style={[styles.badgeText, { color: colors.warning }]}>Expires {new Date(question.expiryTime).toLocaleString()}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>

          <View style={[styles.metaRow, { borderColor: colors.border }]}>
            <View style={styles.metaItem}>
              <ShieldCheck size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Payout</Text>
              <Text style={[styles.metaValue, { color: colors.success }]}>{formatCurrency(question.rewardAmount)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Info size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Spots left</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>{Math.max(question.maxWinners - question.winnersCount, 0)}</Text>
            </View>
          </View>

          <View style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = selectedOption === option.key;
              const isCorrect = Boolean(result?.isCorrect && result && option.key.toLowerCase() === question.correctAnswer.trim().toLowerCase());

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.option,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? withAlpha(colors.primary, 0.08) : colors.secondary,
                    },
                  ]}
                  onPress={() => setSelectedOption(option.key)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                        },
                      ]}
                    />
                    <Text style={[styles.optionLabel, { color: colors.text }]}>{`${option.key.toUpperCase()}. ${option.label}`}</Text>
                  </View>
                  {result && isCorrect && (
                    <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {result && (
            <View
              style={[
                styles.feedback,
                {
                  backgroundColor: withAlpha(result.isCorrect ? colors.success : colors.error, 0.12),
                  borderColor: withAlpha(result.isCorrect ? colors.success : colors.error, 0.4),
                },
              ]}
            >
              <View style={styles.feedbackRow}>
                <CheckCircle2 size={ICON_SIZE.sm} color={result.isCorrect ? colors.success : colors.error} strokeWidth={1.5} />
                <Text
                  style={[
                    styles.feedbackTitle,
                    { color: result.isCorrect ? colors.success : colors.error },
                  ]}
                >
                  {result.isCorrect ? "Correct answer" : result.isExpired || result.isCompleted ? "Unavailable" : "Incorrect answer"}
                </Text>
              </View>
              <Text style={[styles.feedbackText, { color: colors.text }]}> {result.message || "Submission processed."}</Text>
              <Text style={[styles.feedbackMeta, { color: colors.textMuted }]}>Remaining spots: {result.remainingSpots}</Text>
              {result.rewardEarned > 0 && (
                <Text style={[styles.feedbackReward, { color: colors.success }]}>
                  You earned {formatCurrency(result.rewardEarned)}
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + SPACING.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <PrimaryButton
          title={result?.isCorrect ? "Done" : "Submit answer"}
          onPress={result?.isCorrect ? handleBack : handleSubmit}
          loading={submitAnswer.isPending}
          disabled={isDisabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  errorText: {
    marginBottom: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.full,
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },
  scroll: {
    flex: 1,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  metaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  metaLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  metaValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
    marginLeft: SPACING.xs,
  },
  optionsList: {
    gap: SPACING.sm,
  },
  option: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  radio: {
    width: COMPONENT_SIZE.avatar.sm,
    height: COMPONENT_SIZE.avatar.sm,
    borderRadius: RADIUS.full,
    borderWidth: BORDER_WIDTH.thin,
  },
  optionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    flexShrink: 1,
  },
  feedback: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  feedbackTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  feedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  feedbackMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  feedbackReward: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    borderTopWidth: BORDER_WIDTH.thin,
  },
});
