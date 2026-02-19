/**
 * Reward Questions Listing Screen
 *
 * Shows all regular (non-instant) reward questions split into
 * "Available" and "Attempted" tabs so users can see which questions
 * they've answered and which are still open for earning rewards.
 *
 * Pattern mirrors instant-reward-questions.tsx for consistency.
 */

import {
  PrimaryButton,
  QuestionCard,
  SectionHeader,
  StatCard,
} from "@/components";
import { formatCurrency } from "@/services";
import { useRegularRewardQuestions, useRegularRewardQuestionAttempts } from "@/services/hooks";
import type { UserAttemptRecord } from "@/services/hooks";
import { useInstantRewardStore, REWARD_CONSTANTS } from "@/store";
import { useAuth } from "@/utils/auth/useAuth";
import { triggerHaptic } from "@/utils/quiz-utils";
import { InstantRewardListSkeleton } from "@/components/question/QuestionSkeletons";
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
import useUser from "@/utils/useUser";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Lock,
  RefreshCcw,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RewardListItem {
  id: string;
  text: string;
  rewardAmount: number;
  expiryTime: string | null;
  maxWinners: number;
  winnersCount: number;
  createdAt: string;
  isAnswered: boolean;
  isCorrect: boolean;
  rewardEarned: number;
  spotsLeft: number;
  isFull: boolean;
  isExpiringSoon: boolean;
}

// ─── Urgency helpers ─────────────────────────────────────────────────────────

function checkExpiringSoon(expiryTime: string | null): boolean {
  if (!expiryTime) return false;
  const diff = new Date(expiryTime).getTime() - Date.now();
  return diff > 0 && diff < 3600_000;
}

function sortByOpportunity(a: RewardListItem, b: RewardListItem): number {
  if (a.isAnswered !== b.isAnswered) return a.isAnswered ? 1 : -1;
  if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
  if (a.isExpiringSoon !== b.isExpiringSoon) return a.isExpiringSoon ? -1 : 1;
  return a.spotsLeft - b.spotsLeft;
}

// ─── Spots Progress Indicator ────────────────────────────────────────────────

interface SpotsIndicatorProps {
  spotsLeft: number;
  maxWinners: number;
  winnersCount: number;
  isFull: boolean;
  isExpiringSoon: boolean;
  colors: {
    success: string;
    warning: string;
    error: string;
    textMuted: string;
    border: string;
  };
}

const SpotsIndicator = memo(function SpotsIndicator({
  spotsLeft,
  maxWinners,
  winnersCount,
  isFull,
  isExpiringSoon,
  colors,
}: SpotsIndicatorProps) {
  const fillPercent = maxWinners > 0 ? Math.min(winnersCount / maxWinners, 1) : 0;
  const barColor = isFull
    ? colors.error
    : spotsLeft <= 2
      ? colors.warning
      : colors.success;

  return (
    <View style={spotsStyles.container}>
      <View style={[spotsStyles.track, { backgroundColor: withAlpha(colors.border, 0.5) }]}>
        <View style={[spotsStyles.fill, { width: `${fillPercent * 100}%`, backgroundColor: barColor }]} />
      </View>
      <View style={spotsStyles.labels}>
        {isFull ? (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.error, 0.12) }]}>
            <Lock size={10} color={colors.error} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.error }]}>Sold out</Text>
          </View>
        ) : spotsLeft <= 2 ? (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
            <Zap size={10} color={colors.warning} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.warning }]}>
              {spotsLeft === 1 ? "Last spot!" : `${spotsLeft} spots left`}
            </Text>
          </View>
        ) : (
          <Text style={[spotsStyles.spotsText, { color: colors.textMuted }]}>
            {spotsLeft} of {maxWinners} spots left
          </Text>
        )}
        {isExpiringSoon && !isFull && (
          <View style={[spotsStyles.badge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
            <Clock3 size={10} color={colors.warning} strokeWidth={2} />
            <Text style={[spotsStyles.badgeText, { color: colors.warning }]}>Expiring soon</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const spotsStyles = StyleSheet.create({
  container: { gap: SPACING.xs, marginTop: SPACING.sm },
  track: { height: 4, borderRadius: 2, overflow: "hidden" as const },
  fill: { height: "100%" as unknown as number, borderRadius: 2 },
  labels: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
  badge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: { fontFamily: TYPOGRAPHY.fontFamily.bold, fontSize: TYPOGRAPHY.fontSize.xs - 1 },
  spotsText: { fontFamily: TYPOGRAPHY.fontFamily.medium, fontSize: TYPOGRAPHY.fontSize.xs - 1 },
});

// ─── Memoized sub-components ─────────────────────────────────────────────────

const ItemSeparator = memo(function ItemSeparator() {
  return <View style={{ height: SPACING.md }} />;
});

interface AttemptedCardProps {
  item: RewardListItem;
  colors: {
    card: string;
    success: string;
    error: string;
    text: string;
    textMuted: string;
    warning: string;
  };
  onPress: (id: string) => void;
}

const AttemptedCard = memo(function AttemptedCard({
  item,
  colors,
  onPress,
}: AttemptedCardProps) {
  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);

  return (
    <Pressable
      style={[
        styles.attemptedCard,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(
            item.isCorrect ? colors.success : colors.error,
            0.3
          ),
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${item.isCorrect ? "Correct" : "Incorrect"}: ${item.text}`}
    >
      <View style={styles.attemptedCardHeader}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: withAlpha(
                item.isCorrect ? colors.success : colors.error,
                0.12
              ),
            },
          ]}
        >
          {item.isCorrect ? (
            <CheckCircle2
              size={ICON_SIZE.sm}
              color={colors.success}
              strokeWidth={2}
            />
          ) : (
            <XCircle
              size={ICON_SIZE.sm}
              color={colors.error}
              strokeWidth={2}
            />
          )}
          <Text
            style={[
              styles.statusText,
              { color: item.isCorrect ? colors.success : colors.error },
            ]}
          >
            {item.isCorrect ? "Correct" : "Incorrect"}
          </Text>
        </View>
        {item.isCorrect && item.rewardEarned > 0 && (
          <View
            style={[
              styles.rewardBadge,
              { backgroundColor: withAlpha(colors.success, 0.12) },
            ]}
          >
            <Trophy
              size={ICON_SIZE.xs}
              color={colors.success}
              strokeWidth={2}
            />
            <Text style={[styles.rewardText, { color: colors.success }]}>
              +{formatCurrency(item.rewardEarned)}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.attemptedCardText, { color: colors.text }]}
        numberOfLines={2}
      >
        {item.text}
      </Text>
      <View style={styles.attemptedCardFooter}>
        <Text style={[styles.attemptedCardMeta, { color: colors.textMuted }]}>
          {formatCurrency(item.rewardAmount)} reward
        </Text>
        <Text style={[styles.attemptedCardMeta, { color: colors.textMuted }]}>
          {item.spotsLeft} spot{item.spotsLeft !== 1 ? "s" : ""} left
        </Text>
      </View>
    </Pressable>
  );
});

// ─── Memoized Available Question Item ─────────────────────────────────────
// Extracted from renderItem to prevent re-creation of question object and onPress
// closure on every FlatList render cycle. Props are shallow-compared by memo.

interface AvailableQuestionItemProps {
  item: RewardListItem;
  colors: ReturnType<typeof useTheme>["colors"];
  onPress: (id: string) => void;
}

const dimmedItemStyle = { opacity: 0.55 } as const;

const AvailableQuestionItem = memo(function AvailableQuestionItem({
  item,
  colors,
  onPress,
}: AvailableQuestionItemProps) {
  const question = useMemo(
    () => ({
      id: item.id,
      text: item.text,
      userId: null,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      rewardAmount: item.rewardAmount,
      isInstantReward: false,
      totalAnswers: item.winnersCount,
      category: "Rewards",
    }),
    [item.id, item.text, item.createdAt, item.rewardAmount, item.winnersCount]
  );

  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);

  return (
    <View style={item.isFull ? dimmedItemStyle : undefined}>
      <QuestionCard
        question={question}
        variant="default"
        onPress={handlePress}
      />
      <SpotsIndicator
        spotsLeft={item.spotsLeft}
        maxWinners={item.maxWinners}
        winnersCount={item.winnersCount}
        isFull={item.isFull}
        isExpiringSoon={item.isExpiringSoon}
        colors={colors}
      />
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function RewardQuestionsScreen(): React.ReactElement {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useUser();
  const { isReady: authReady, isAuthenticated, auth } = useAuth();
  const [activeTab, setActiveTab] = useState<"available" | "attempted">(
    "available"
  );

  // Regular (non-instant) reward questions
  const {
    data: rewardQuestions = [],
    isLoading,
    error: rewardError,
    refetch,
    isFetching,
  } = useRegularRewardQuestions();

  // Server-provided attempt records (shares cache with useRegularRewardQuestions — no extra fetch)
  const { data: serverAttempts = [] } = useRegularRewardQuestionAttempts();

  // Attempt tracking from Zustand store
  const initializeAttemptHistory = useInstantRewardStore(
    (s) => s.initializeAttemptHistory
  );
  const hasAttemptedQuestion = useInstantRewardStore(
    (s) => s.hasAttemptedQuestion
  );
  const getAttemptedQuestion = useInstantRewardStore(
    (s) => s.getAttemptedQuestion
  );
  const markQuestionAttempted = useInstantRewardStore(
    (s) => s.markQuestionAttempted
  );

  const userEmail = auth?.user?.email || user?.email;

  // Zustand: wallet sync action
  const syncWalletFromServer = useInstantRewardStore((s) => s.syncWalletFromServer);

  useEffect(() => {
    if (userEmail) {
      initializeAttemptHistory(userEmail);
    }
  }, [userEmail, initializeAttemptHistory]);

  // Sync Zustand wallet balance from server-side user points (prevents drift after app restart)
  useEffect(() => {
    if (user?.points != null) {
      syncWalletFromServer(user.points * REWARD_CONSTANTS.POINTS_TO_UGX_RATE);
    }
  }, [user?.points, syncWalletFromServer]);

  // Hydrate local store from server-provided attempts so the UI stays in sync
  // even after app restarts or store clears.
  useEffect(() => {
    if (!serverAttempts.length) return;
    for (const sa of serverAttempts) {
      if (!hasAttemptedQuestion(sa.rewardQuestionId)) {
        markQuestionAttempted({
          questionId: sa.rewardQuestionId,
          isCorrect: sa.isCorrect,
          selectedAnswer: sa.selectedAnswer,
          rewardEarned: 0,
          isWinner: false,
          position: null,
          paymentStatus: null,
        });
      }
    }
  }, [serverAttempts, hasAttemptedQuestion, markQuestionAttempted]);

  // Build a fast lookup of server-side attempted question IDs
  const serverAttemptMap = useMemo(() => {
    const map = new Map<string, UserAttemptRecord>();
    for (const a of serverAttempts) map.set(a.rewardQuestionId, a);
    return map;
  }, [serverAttempts]);

  // ── Build list items with attempt status ──
  const allItems = useMemo<RewardListItem[]>(() => {
    return (rewardQuestions || []).map((q) => {
      const localAttempt = getAttemptedQuestion(q.id);
      const serverAttempt = serverAttemptMap.get(q.id);
      // Question is answered if EITHER the server or local store says so
      const isAnswered = hasAttemptedQuestion(q.id) || !!serverAttempt;
      const spots = Math.max(q.maxWinners - q.winnersCount, 0);
      return {
        id: q.id,
        text: q.text,
        rewardAmount: q.rewardAmount || REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT,
        expiryTime: q.expiryTime,
        maxWinners: q.maxWinners,
        winnersCount: q.winnersCount,
        createdAt: q.createdAt,
        isAnswered,
        isCorrect: localAttempt?.isCorrect ?? serverAttempt?.isCorrect ?? false,
        rewardEarned: localAttempt?.rewardEarned ?? 0,
        spotsLeft: spots,
        isFull: spots <= 0 || q.isCompleted,
        isExpiringSoon: checkExpiringSoon(q.expiryTime),
      };
    });
  }, [rewardQuestions, hasAttemptedQuestion, getAttemptedQuestion, serverAttemptMap]);

  const availableQuestions = useMemo(
    () => allItems.filter((q) => !q.isAnswered).sort(sortByOpportunity),
    [allItems]
  );
  const attemptedQuestions = useMemo(
    () => allItems.filter((q) => q.isAnswered),
    [allItems]
  );

  // Derived counts
  const openQuestions = useMemo(() => availableQuestions.filter(q => !q.isFull), [availableQuestions]);
  const closedQuestions = useMemo(() => availableQuestions.filter(q => q.isFull), [availableQuestions]);

  // ── Stats ──
  const totalRewardsEarned = useMemo(
    () => attemptedQuestions.reduce((sum, q) => sum + q.rewardEarned, 0),
    [attemptedQuestions]
  );
  const correctCount = useMemo(
    () => attemptedQuestions.filter((q) => q.isCorrect).length,
    [attemptedQuestions]
  );

  // ── Displayed list ──
  const displayedQuestions = useMemo(
    () => (activeTab === "available" ? availableQuestions : attemptedQuestions),
    [activeTab, availableQuestions, attemptedQuestions]
  );

  // Refs for stable callback access — avoids recreating handleOpenQuestion
  // on every data refetch (same pattern as instant-reward-questions.tsx)
  const allItemsRef = useRef(allItems);
  allItemsRef.current = allItems;
  const openQuestionsRef = useRef(openQuestions);
  openQuestionsRef.current = openQuestions;

  // ── Handlers ──
  const handleRefresh = useCallback(async () => {
    triggerHaptic("light");
    await refetch();
  }, [refetch]);

  const handleBack = useCallback(() => {
    triggerHaptic("light");
    router.back();
  }, []);

  // Stable callback — reads data from refs so it doesn't recreate on every refetch.
  // This is the #1 fix: previously, allItems/openQuestions in deps caused
  // handleOpenQuestion → renderItem → ALL items to re-render on every data change.
  const handleOpenQuestion = useCallback(
    (id: string) => {
      if (!authReady) return;
      triggerHaptic("medium");
      if (!isAuthenticated) {
        router.push("/(auth)/login" as Href);
        return;
      }
      // Intercept full questions — show alert instead of navigating (read from ref for latest data)
      const item = allItemsRef.current.find(q => q.id === id);
      if (item?.isFull && !item.isAnswered) {
        triggerHaptic("warning");
        const nextOpen = openQuestionsRef.current.find(q => q.id !== id);
        Alert.alert(
          "No Spots Left",
          "All winner spots have been filled for this question.",
          nextOpen
            ? [
                { text: "OK", style: "cancel" },
                {
                  text: "Try Another",
                  onPress: () => router.push(`/reward-question/${nextOpen.id}` as Href),
                },
              ]
            : [{ text: "OK" }]
        );
        return;
      }
      router.push(`/reward-question/${id}` as Href);
    },
    [authReady, isAuthenticated]
  );

  const handleSelectAvailable = useCallback(() => {
    triggerHaptic("selection");
    setActiveTab("available");
  }, []);

  const handleSelectAttempted = useCallback(() => {
    triggerHaptic("selection");
    setActiveTab("attempted");
  }, []);

  // ── Dynamic display amount ──
  const displayRewardAmount = useMemo(() => {
    if (allItems.length > 0) return allItems[0].rewardAmount;
    return REWARD_CONSTANTS.INSTANT_REWARD_AMOUNT;
  }, [allItems]);

  // ── Key extractor ──
  const keyExtractor = useCallback((item: RewardListItem) => item.id, []);

  // ── Render item ──
  // Use item.isAnswered instead of activeTab — displayedQuestions already
  // filters by tab, so this avoids recreating renderItem on tab switch
  // (which would force every visible cell to re-render).
  const renderItem = useCallback(
    ({ item }: { item: RewardListItem }) => {
      if (!item.isAnswered) {
        return (
          <AvailableQuestionItem
            item={item}
            colors={colors}
            onPress={handleOpenQuestion}
          />
        );
      }

      return (
        <AttemptedCard
          item={item}
          colors={colors}
          onPress={handleOpenQuestion}
        />
      );
    },
    [handleOpenQuestion, colors]
  );

  // ── List header ──
  const listHeader = useMemo(
    () => (
      <>
        {/* Hero card */}
        <LinearGradient
          colors={[
            withAlpha(colors.primary, 0.08),
            withAlpha(colors.warning, 0.04),
          ]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: withAlpha(colors.primary, 0.12) },
            ]}
          >
            <Sparkles
              size={ICON_SIZE["4xl"]}
              color={colors.primary}
              strokeWidth={1.5}
            />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Reward Questions
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Earn {formatCurrency(displayRewardAmount)} per correct answer
            — one attempt only!
          </Text>
          <View style={styles.heroStats}>
            <StatCard
              icon={
                <Circle
                  size={ICON_SIZE.sm}
                  color={colors.primary}
                  strokeWidth={1.5}
                />
              }
              title="Open"
              value={openQuestions.length}
              subtitle="Spots available"
            />
            <StatCard
              icon={
                <Lock
                  size={ICON_SIZE.sm}
                  color={colors.textMuted}
                  strokeWidth={1.5}
                />
              }
              title="Closed"
              value={closedQuestions.length + attemptedQuestions.length}
              subtitle="Full or answered"
            />
            <StatCard
              icon={
                <Trophy
                  size={ICON_SIZE.sm}
                  color={colors.warning}
                  strokeWidth={1.5}
                />
              }
              title="Earned"
              value={formatCurrency(totalRewardsEarned)}
              subtitle={`${correctCount} correct`}
            />
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View
          style={[
            styles.tabContainer,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Pressable
            style={[
              styles.tab,
              activeTab === "available" && {
                backgroundColor: colors.card,
              },
            ]}
            onPress={handleSelectAvailable}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "available" }}
          >
            <Circle
              size={ICON_SIZE.xs}
              color={
                activeTab === "available"
                  ? colors.primary
                  : colors.textMuted
              }
              strokeWidth={2}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "available"
                      ? colors.text
                      : colors.textMuted,
                },
              ]}
            >
              Available ({availableQuestions.length})
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === "attempted" && {
                backgroundColor: colors.card,
              },
            ]}
            onPress={handleSelectAttempted}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "attempted" }}
          >
            <CheckCircle2
              size={ICON_SIZE.xs}
              color={
                activeTab === "attempted"
                  ? colors.success
                  : colors.textMuted
              }
              strokeWidth={2}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "attempted"
                      ? colors.text
                      : colors.textMuted,
                },
              ]}
            >
              Attempted ({attemptedQuestions.length})
            </Text>
          </Pressable>
        </View>

        {/* Section header */}
        <SectionHeader
          title={
            activeTab === "available"
              ? "Answer to earn"
              : "Your attempted questions"
          }
          subtitle={
            activeTab === "available"
              ? `${openQuestions.length} open · ${formatCurrency(displayRewardAmount)} per correct answer`
              : `${correctCount} correct out of ${attemptedQuestions.length}`
          }
          icon={
            activeTab === "available" ? (
              <Sparkles
                size={ICON_SIZE.sm}
                color={colors.warning}
                strokeWidth={1.5}
              />
            ) : (
              <CheckCircle2
                size={ICON_SIZE.sm}
                color={colors.success}
                strokeWidth={1.5}
              />
            )
          }
        />

        {isLoading && <InstantRewardListSkeleton count={4} />}
        {!isLoading && rewardError && (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Sparkles
              size={ICON_SIZE["2xl"]}
              color={colors.error}
              strokeWidth={1.5}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Failed to load questions
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Please check your connection and try again.
            </Text>
            <PrimaryButton
              title="Retry"
              onPress={handleRefresh}
              loading={isFetching}
              style={{ marginTop: SPACING.md }}
            />
          </View>
        )}
      </>
    ),
    [
      colors,
      displayRewardAmount,
      availableQuestions.length,
      attemptedQuestions.length,
      openQuestions.length,
      closedQuestions.length,
      totalRewardsEarned,
      correctCount,
      activeTab,
      isLoading,
      rewardError,
      isFetching,
      handleRefresh,
      handleSelectAvailable,
      handleSelectAttempted,
    ]
  );

  // ── Empty state ──
  const listEmpty = useMemo(() => {
    if (isLoading || rewardError) return null;
    if (activeTab === "available") {
      return (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <CheckCircle2
            size={ICON_SIZE["2xl"]}
            color={colors.success}
            strokeWidth={1.5}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            All caught up!
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            You&apos;ve attempted all available reward questions. Check back soon for
            new ones!
          </Text>
          <PrimaryButton
            title="Refresh"
            onPress={handleRefresh}
            loading={isFetching}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      );
    }
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Circle
          size={ICON_SIZE["2xl"]}
          color={colors.textMuted}
          strokeWidth={1.5}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No attempted questions yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Start answering reward questions to track your progress here!
        </Text>
      </View>
    );
  }, [isLoading, rewardError, activeTab, colors, handleRefresh, isFetching]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
          hitSlop={8}
        >
          <ArrowLeft
            size={ICON_SIZE.base}
            color={colors.text}
            strokeWidth={1.5}
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Reward Questions
        </Text>
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Refresh questions"
        >
          <RefreshCcw
            size={ICON_SIZE.base}
            color={isFetching ? colors.primary : colors.text}
            strokeWidth={1.5}
          />
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={displayedQuestions}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: insets.bottom + SPACING["2xl"],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews
        initialNumToRender={6}
        ItemSeparatorComponent={ItemSeparator}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  heroIcon: {
    width: COMPONENT_SIZE.avatar.lg,
    height: COMPONENT_SIZE.avatar.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  attemptedCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  attemptedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  attemptedCardText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  attemptedCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attemptedCardMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});
