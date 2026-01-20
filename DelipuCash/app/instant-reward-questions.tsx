import {
    PrimaryButton,
    QuestionCard,
    SectionHeader,
    StatCard,
    UploadRewardQuestionModal,
} from "@/components";
import { formatCurrency } from "@/data/mockData";
import { useRewardQuestions } from "@/services/hooks";
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
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Plus, RefreshCcw, Sparkles, Zap } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RewardListItem {
  id: string;
  text: string;
  rewardAmount: number;
  expiryTime: string | null;
  maxWinners: number;
  winnersCount: number;
  isInstantReward: boolean;
  createdAt: string;
}

export default function InstantRewardQuestionsScreen(): React.ReactElement {
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useUser();
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { data: rewardQuestions, isLoading, refetch, isFetching } = useRewardQuestions();

  /**
   * Role-based access control: Check user's role field from backend
   * instead of inferring from email address (which is insecure)
   */
  const isAdmin = user?.role === "ADMIN" || user?.role === "MODERATOR";

  const activeQuestions = useMemo<RewardListItem[]>(() => {
    const now = new Date();
    return (rewardQuestions || [])
      .filter((q) => q.isInstantReward)
      .filter((q) => {
        if (!q.expiryTime) return true;
        return new Date(q.expiryTime) > now;
      })
      .map((q) => ({
        id: q.id,
        text: q.text,
        rewardAmount: q.rewardAmount,
        expiryTime: q.expiryTime,
        maxWinners: q.maxWinners,
        winnersCount: q.winnersCount,
        isInstantReward: true,
        createdAt: q.createdAt,
      }));
  }, [rewardQuestions]);

  const topReward = useMemo(() => {
    return activeQuestions.reduce((max, q) => (q.rewardAmount > max ? q.rewardAmount : max), 0);
  }, [activeQuestions]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleUpload = useCallback(() => {
    setShowUploadModal(true);
  }, []);

  const handleOpenQuestion = useCallback((id: string) => {
    router.push(`/instant-reward-answer/${id}`);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar style={statusBarStyle} />
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Instant Reward Questions</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.secondary }]}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh questions"
          >
            {isFetching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <RefreshCcw size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
            )}
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.primary }]}
              onPress={handleUpload}
              accessibilityRole="button"
              accessibilityLabel="Upload question"
            >
              <Plus size={ICON_SIZE.base} color={colors.primaryText} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['2xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <LinearGradient
          colors={[withAlpha(colors.primary, 0.08), withAlpha(colors.warning, 0.04)]}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
            <Zap size={ICON_SIZE['4xl']} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Answer fast. Earn instantly.</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>Top rewards up to {formatCurrency(topReward)}. First correct answers win.</Text>
          <View style={styles.heroStats}>
            <StatCard
              icon={<Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
              title="Active"
              value={activeQuestions.length}
              subtitle="Questions live"
            />
            <StatCard
              icon={<Zap size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
              title="Max reward"
              value={formatCurrency(topReward)}
              subtitle="Potential payout"
            />
          </View>
        </LinearGradient>

        <SectionHeader
          title="Live now"
          subtitle="Instant payout questions"
          icon={<Zap size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />}
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading instant reward questions...</Text>
          </View>
        ) : activeQuestions.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No instant reward questions</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Check back soon or refresh to see new questions.</Text>
            <PrimaryButton title="Refresh" onPress={handleRefresh} loading={isFetching} style={{ marginTop: SPACING.md }} />
          </View>
        ) : (
          <View style={styles.list}>
            {activeQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={{
                  id: q.id,
                  text: q.text,
                  userId: null,
                  createdAt: q.createdAt,
                  updatedAt: q.createdAt,
                  rewardAmount: q.rewardAmount,
                  isInstantReward: true,
                  totalAnswers: q.winnersCount,
                  category: "Rewards",
                }}
                variant="default"
                onPress={() => handleOpenQuestion(q.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      <UploadRewardQuestionModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </View>
  );
}

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
  heroIcon: {
    width: COMPONENT_SIZE.avatar.lg,
    height: COMPONENT_SIZE.avatar.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  empty: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  list: {
    gap: SPACING.md,
  },
  headerActions: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
});
