import { PrimaryButton, StatCard } from "@/components";
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
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    PartyPopper,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    Users,
    Zap,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
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

export default function InstantRewardAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [result, setResult] = useState<RewardAnswerResult | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const questionId = id || "";
  const { data: question, isLoading, error, refetch, isFetching } = useRewardQuestion(questionId);
  const submitAnswer = useSubmitRewardAnswer();

  useEffect(() => {
    if (!question?.expiryTime) {
      setTimeLeft(0);
      return;
    }

    const expiry = new Date(question.expiryTime).getTime();
    const update = (): void => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [question?.expiryTime]);

  const options = useMemo(() => {
    if (!question?.options) return [] as { key: string; label: string }[];
    return Object.entries(question.options).map(([key, label]) => ({ key, label: String(label) }));
  }, [question]);

  const spotsLeft = useMemo(() => {
    if (!question) return 0;
    return Math.max(question.maxWinners - question.winnersCount, 0);
  }, [question]);

  const isExpired = useMemo(() => {
    if (!question?.expiryTime) return false;
    return new Date(question.expiryTime).getTime() <= Date.now() || timeLeft <= 0;
  }, [question?.expiryTime, timeLeft]);

  const isClosed = Boolean(
    isExpired ||
      question?.isCompleted ||
      spotsLeft <= 0 ||
      result?.isCorrect ||
      result?.isExpired ||
      result?.isCompleted
  );

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

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading instant reward...</Text>
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Instant reward not found</Text>
        <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
      </View>
    );
  }

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
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Instant reward</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Answer quickly. First correct wins.</Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCcw size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
      >
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.14), withAlpha(colors.warning, 0.08)]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={styles.heroTop}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.success, 0.12) }]}> 
              <Zap size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Live</Text>
            </View>
            {question.expiryTime && (
              <View style={[styles.timerPill, { backgroundColor: withAlpha(colors.warning, 0.12) }]}> 
                <Clock3 size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
                <Text style={[styles.timerText, { color: colors.warning }]}>
                  {isExpired ? "Expired" : formatTime(timeLeft)}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>{formatCurrency(question.rewardAmount)}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>First {question.maxWinners} correct winners</Text>

          <View style={styles.heroStats}>
            <StatCard
              icon={<Users size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
              title="Spots left"
              value={spotsLeft}
              subtitle="Remaining winners"
            />
            <StatCard
              icon={<ShieldCheck size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
              title="Status"
              value={isClosed ? "Closed" : "Active"}
              subtitle={question.isCompleted ? "Completed" : "Live"}
            />
          </View>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.cardHeader}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}> 
              <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Instant reward</Text>
            </View>
            {question.createdAt && (
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                Added {new Date(question.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>

          <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>

          <View style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = selectedOption === option.key;
              const isCorrect = Boolean(
                result?.isCorrect &&
                  result &&
                  question.correctAnswer.trim().toLowerCase() === option.key.trim().toLowerCase()
              );

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
                  disabled={isClosed}
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
                  {isCorrect && <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
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
                  borderColor: withAlpha(result.isCorrect ? colors.success : colors.error, 0.5),
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
              <Text style={[styles.feedbackText, { color: colors.text }]}>{result.message || "Submission processed."}</Text>
              <Text style={[styles.feedbackMeta, { color: colors.textMuted }]}>Remaining spots: {result.remainingSpots}</Text>
              {result.rewardEarned > 0 && (
                <Text style={[styles.feedbackReward, { color: colors.success }]}>You earned {formatCurrency(result.rewardEarned)}</Text>
              )}
            </View>
          )}
        </View>

        {Boolean(question.winners && question.winners.length) && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: withAlpha(colors.info, 0.12) }]}> 
                <PartyPopper size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />
                <Text style={[styles.badgeText, { color: colors.info }]}>Winners</Text>
              </View>
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>Latest payouts</Text>
            </View>

            {(question.winners || []).map((winner) => (
              <View key={winner.id} style={[styles.winnerRow, { borderColor: colors.border }]}> 
                <View style={styles.winnerLeft}>
                  <Text style={[styles.winnerPosition, { color: colors.primary }]}>{winner.position}.</Text>
                  <View style={styles.winnerInfo}>
                    <Text style={[styles.winnerEmail, { color: colors.text }]} numberOfLines={1}>
                      {winner.userEmail}
                    </Text>
                    <Text style={[styles.winnerStatus, { color: colors.textMuted }]}>{winner.paymentStatus}</Text>
                  </View>
                </View>
                <Text style={[styles.winnerAmount, { color: colors.success }]}>{formatCurrency(winner.amountAwarded)}</Text>
              </View>
            ))}
          </View>
        )}
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
          title={result?.isCorrect ? "Done" : isClosed ? "Closed" : "Submit answer"}
          onPress={result?.isCorrect ? handleBack : handleSubmit}
          loading={submitAnswer.isPending}
          disabled={isClosed}
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
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.full,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  scroll: {
    flex: 1,
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
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
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  feedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  feedbackMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  feedbackReward: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.hairline,
  },
  winnerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },
  winnerPosition: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  winnerStatus: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  winnerAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  footer: {
    borderTopWidth: BORDER_WIDTH.thin,
    padding: SPACING.lg,
  },
});
