/**
 * Question Answer Screen — Collaborative Q&A
 *
 * A Quora/StackOverflow-style question discussion and answer screen.
 *
 * Properly wired with:
 * - TanStack Query v5 via useQuestionDetail + useSubmitQuestionResponse (optimistic updates)
 * - Zustand for draft text / submission guard (ephemeral UI state)
 * - Unified query keys so feed ↔ detail caches stay in sync
 * - Auth check before submission
 * - Keyboard avoiding for better mobile UX
 * - Accessible, memoized sub-components
 */

import { PrimaryButton } from "@/components";
import { AnswerQuestionSkeleton } from "@/components/question/QuestionSkeletons";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/services/api";
import {
  useQuestionDetail,
  useSubmitQuestionResponse,
} from "@/services/questionHooks";
import {
  useQuestionAnswerStore,
  ANSWER_MAX_LENGTH,
  selectIsValidLength,
  selectWasSubmitted,
} from "@/store";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  ThemeColors,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import { triggerHaptic } from "@/utils/quiz-utils";
import { Href, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  CheckCircle,
  MessageSquare,
  Send,
  HelpCircle,
  AlertCircle,
  Users,
  Clock,
  RefreshCw,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useUser from "@/utils/useUser";

// ─── Memoized sub-components ─────────────────────────────────────────────────

interface ResponseItemProps {
  item: {
    id: string;
    user?: { firstName?: string; lastName?: string } | null;
    createdAt: string;
    responseText: string;
  };
  colors: ThemeColors;
  isOptimistic?: boolean;
}

const ResponseItem = memo(function ResponseItem({
  item,
  colors,
  isOptimistic,
}: ResponseItemProps) {
  const authorName = useMemo(
    () =>
      item.user?.firstName
        ? `${item.user.firstName} ${item.user.lastName ?? ""}`.trim()
        : "Anonymous",
    [item.user?.firstName, item.user?.lastName]
  );

  return (
    <View
      style={[
        styles.responseCard,
        { borderColor: colors.border },
        isOptimistic && { opacity: 0.7, borderStyle: "dashed" as any },
      ]}
      accessible={true}
      accessibilityLabel={`Response by ${authorName}`}
    >
      <View style={styles.responseHeader}>
        <View style={styles.responseAuthorRow}>
          <Text style={[styles.responseAuthor, { color: colors.text }]}>
            {authorName}
          </Text>
          {isOptimistic && (
            <Text style={[styles.pendingBadge, { color: colors.textMuted }]}>
              Sending…
            </Text>
          )}
        </View>
        <Text style={[styles.responseDate, { color: colors.textMuted }]}>
          {formatDate(item.createdAt)}
        </Text>
      </View>
      <Text style={[styles.responseText, { color: colors.text }]}>
        {item.responseText}
      </Text>
    </View>
  );
});

// ─── Answer Submitted Banner ─────────────────────────────────────────────────

interface SubmittedBannerProps {
  colors: ThemeColors;
}

const SubmittedBanner = memo(function SubmittedBanner({
  colors,
}: SubmittedBannerProps) {
  return (
    <View
      style={[
        styles.rewardBanner,
        { backgroundColor: withAlpha(colors.success || "#22c55e", 0.12) },
      ]}
    >
      <CheckCircle
        size={ICON_SIZE.md}
        color={colors.success || "#22c55e"}
        strokeWidth={1.5}
      />
      <View style={styles.rewardBannerContent}>
        <Text
          style={[
            styles.rewardBannerTitle,
            { color: colors.success || "#22c55e" },
          ]}
        >
          Answer submitted!
        </Text>
        <Text
          style={[
            styles.rewardBannerAmount,
            { color: colors.success || "#22c55e" },
          ]}
        >
          Thanks for contributing to the community
        </Text>
      </View>
    </View>
  );
});

// ─── Character Count Indicator ───────────────────────────────────────────────
// 2026 industry standard: hidden until near max, progressive color (muted → warning → error)

interface CharCountProps {
  current: number;
  max: number;
  colors: ThemeColors;
}

const CHAR_WARNING_THRESHOLD = 50;
const CHAR_DANGER_THRESHOLD = 20;

const CharCountIndicator = memo(function CharCountIndicator({
  current,
  max,
  colors,
}: CharCountProps) {
  const remaining = max - current;

  // Only visible when approaching the limit
  if (remaining >= CHAR_WARNING_THRESHOLD) return null;

  const color =
    remaining <= CHAR_DANGER_THRESHOLD
      ? colors.error
      : colors.warning;

  return (
    <Text style={[styles.charCount, { color }]}>{remaining}</Text>
  );
});

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function QuestionAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionId = id || "";
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const submitDebounceRef = useRef(false);
  const { data: user, loading: userLoading } = useUser();
  const isAuthenticated = !!user;
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  // ── Zustand selectors (granular — avoid full-store re-renders) ──
  const draftText = useQuestionAnswerStore(
    (s) => s.drafts[questionId]?.text ?? ""
  );
  const isValidLength = useQuestionAnswerStore(selectIsValidLength(questionId));
  const wasSubmitted = useQuestionAnswerStore(selectWasSubmitted(questionId));
  const updateDraft = useQuestionAnswerStore((s) => s.updateDraft);
  const markSubmitted = useQuestionAnswerStore((s) => s.markSubmitted);
  const setActiveQuestion = useQuestionAnswerStore((s) => s.setActiveQuestion);

  // ── Server state (unified query keys — syncs with feed cache) ──
  const {
    data: question,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuestionDetail(questionId);

  // Uses optimistic mutation from questionHooks — updates detail + feed caches
  const submitResponse = useSubmitQuestionResponse();

  // ── Derived (memoized) ──
  const responses = useMemo(
    () => question?.responses || [],
    [question?.responses]
  );
  const responseCount = responses.length;

  // ── Effects ──
  useEffect(() => {
    if (questionId) setActiveQuestion(questionId);
  }, [questionId, setActiveQuestion]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!userLoading && !isAuthenticated) {
      router.replace("/(auth)/login" as Href);
    }
  }, [userLoading, isAuthenticated]);

  // ── Callbacks (stable refs) ──
  const handleBack = useCallback((): void => {
    triggerHaptic('light');
    router.back();
  }, []);

  const handleDiscussion = useCallback((): void => {
    if (!question) return;
    triggerHaptic('medium');
    router.push({
      pathname: "/question-detail",
      params: { id: question.id },
    } as Href);
  }, [question]);

  const handleTextChange = useCallback(
    (text: string) => {
      updateDraft(questionId, text);
    },
    [questionId, updateDraft]
  );

  const handleSubmit = useCallback((): void => {
    if (!question || wasSubmitted) return;
    if (submitDebounceRef.current) return;

    if (!isAuthenticated) {
      router.push("/(auth)/login" as Href);
      return;
    }

    const trimmed = draftText.trim();
    if (!trimmed) return;

    triggerHaptic('medium');
    Keyboard.dismiss();
    submitDebounceRef.current = true;

    submitResponse.mutate(
      { questionId: question.id, responseText: trimmed },
      {
        onSuccess: () => {
          markSubmitted(question.id);
          submitDebounceRef.current = false;

          // Scroll to bottom to see the new response
          scrollRef.current?.scrollToEnd({ animated: true });

          triggerHaptic('success');
          showToast({
            message: 'Answer submitted! Thanks for contributing your knowledge.',
            type: 'success',
            action: 'View discussion',
            onAction: () =>
              router.push({
                pathname: "/question-detail",
                params: { id: question.id },
              } as Href),
          });
        },
        onError: (err) => {
          submitDebounceRef.current = false;
          const message =
            err?.message === "You have already responded to this question"
              ? "You've already answered this question."
              : "Could not submit your answer. Please try again.";
          triggerHaptic('error');
          showToast({ message, type: 'error' });
        },
      }
    );
  }, [
    question,
    wasSubmitted,
    isAuthenticated,
    draftText,
    submitResponse,
    markSubmitted,
    showToast,
  ]);

  const onRefresh = useCallback(async () => {
    triggerHaptic('light');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Auth loading / redirect ──
  if (userLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar style={statusBarStyle} />
        <AnswerQuestionSkeleton />
      </View>
    );
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar style={statusBarStyle} />
        <AnswerQuestionSkeleton />
      </View>
    );
  }

  // ── Error state ──
  if (error || !question) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <StatusBar style={statusBarStyle} />
        <AlertCircle
          size={ICON_SIZE['5xl']}
          color={colors.error}
          strokeWidth={1.5}
          style={{ marginBottom: SPACING.md }}
        />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error?.message || "Question not found"}
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => { triggerHaptic('light'); refetch(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading question"
            hitSlop={8}
          >
            <RefreshCw size={ICON_SIZE.sm} color={colors.primaryText} strokeWidth={1.5} />
            <Text style={[styles.retryText, { color: colors.primaryText }]}>Retry</Text>
          </Pressable>
          <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
        </View>
      </View>
    );
  }

  const isDisabled = submitResponse.isPending || wasSubmitted;
  const canSubmit = isValidLength && !isDisabled;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style={statusBarStyle} />

      {/* ── Header ────────────────────────────────────────────────────── */}
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
        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to previous screen"
          hitSlop={8}
        >
          <ArrowLeft
            size={ICON_SIZE.md}
            color={colors.text}
            strokeWidth={1.5}
          />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Comment
          </Text>
          <View style={styles.headerRewardRow}>
            <MessageSquare
              size={ICON_SIZE.sm}
              color={colors.textMuted}
              strokeWidth={1.5}
            />
            <Text
              style={[styles.headerSubtitle, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {responseCount} {responseCount === 1 ? "answer" : "answers"}
            </Text>
          </View>
        </View>
        {isFetching && !isLoading && (
          <RefreshCw size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
        )}
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: SPACING.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Submission confirmation banner */}
        {wasSubmitted && (
          <SubmittedBanner colors={colors} />
        )}

        {/* Hero card */}
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.heroHeader}>
            <View
              style={[
                styles.badge,
                { backgroundColor: withAlpha(colors.primary, 0.12) },
              ]}
            >
              <HelpCircle
                size={ICON_SIZE.sm}
                color={colors.primary}
                strokeWidth={1.5}
              />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {question.category || "Question"}
              </Text>
            </View>
            <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
              {formatDate(question.createdAt)}
            </Text>
          </View>
          <Text style={[styles.questionText, { color: colors.text }]}>
            {question.text}
          </Text>
          <View style={styles.heroStats}>
            <View
              style={[styles.statCard, { backgroundColor: colors.secondary }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                <Users size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Answers
                </Text>
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {responseCount}
              </Text>
            </View>
            <View
              style={[styles.statCard, { backgroundColor: colors.secondary }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                <Clock size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                  Posted
                </Text>
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatDate(question.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        {/* Responses */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessibilityRole="list"
          accessibilityLabel={`${responseCount} responses`}
        >
          <View style={styles.responsesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Responses
            </Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
              {responseCount} total
            </Text>
          </View>
          {responseCount === 0 && (
            <View style={styles.emptyResponseState}>
              <MessageSquare
                size={ICON_SIZE.lg}
                color={colors.textMuted}
                strokeWidth={1}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No answers yet. Be the first to share your knowledge!
              </Text>
            </View>
          )}
          {responses.map((item) => (
            <View key={item.id} style={{ marginBottom: SPACING.md }}>
              <ResponseItem
                item={item}
                colors={colors}
                isOptimistic={item.id?.startsWith("optimistic_")}
              />
            </View>
          ))}
        </View>

        {/* View full discussion link */}
        <Pressable
          style={[styles.discussionButton, { borderColor: colors.border, marginBottom: SPACING.md }]}
          onPress={handleDiscussion}
          accessibilityRole="button"
          accessibilityLabel="Open discussion"
          accessibilityHint="View the full discussion thread"
          hitSlop={4}
        >
          <MessageSquare
            size={ICON_SIZE.sm}
            color={colors.text}
            strokeWidth={1.5}
          />
          <Text style={[styles.discussionText, { color: colors.text }]}>
            View full discussion ({responseCount})
          </Text>
        </Pressable>
      </ScrollView>

      {/* ── Bottom Input Bar ────────────────────────────────────────── */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + SPACING.xs,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        {wasSubmitted ? (
          <View style={styles.submittedBar}>
            <CheckCircle
              size={ICON_SIZE.sm}
              color={colors.success || "#22c55e"}
              strokeWidth={1.5}
            />
            <Text
              style={[
                styles.submittedBarText,
                { color: colors.success || "#22c55e" },
              ]}
            >
              Answer submitted
            </Text>
          </View>
        ) : (
          <View style={styles.bottomBarContent}>
            <View style={styles.bottomBarInputRow}>
              <View
                style={[
                  styles.bottomInputWrapper,
                  {
                    borderColor:
                      draftText.length > 0 ? colors.primary : colors.border,
                    backgroundColor: colors.secondary,
                  },
                ]}
              >
                <TextInput
                  style={[styles.bottomInput, { color: colors.text }]}
                  placeholder="Share your knowledge or experience\u2026"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={draftText}
                  onChangeText={handleTextChange}
                  maxLength={ANSWER_MAX_LENGTH}
                  textAlignVertical="top"
                  editable={!isDisabled}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  accessibilityLabel="Answer text input"
                  accessibilityHint={`Maximum ${ANSWER_MAX_LENGTH} characters`}
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  {
                    backgroundColor: canSubmit
                      ? colors.primary
                      : withAlpha(colors.primary, 0.4),
                    opacity: pressed && canSubmit ? 0.85 : 1,
                    transform: [{ scale: pressed && canSubmit ? 0.95 : 1 }],
                  },
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel={
                  canSubmit ? "Submit answer" : "Write an answer to submit"
                }
                accessibilityState={{ disabled: !canSubmit }}
              >
                {submitResponse.isPending ? (
                  <Send
                    size={ICON_SIZE.sm}
                    color={colors.primaryText}
                    strokeWidth={1.5}
                    style={{ opacity: 0.5 }}
                  />
                ) : (
                  <Send
                    size={ICON_SIZE.sm}
                    color={colors.primaryText}
                    strokeWidth={1.5}
                  />
                )}
              </Pressable>
            </View>
            <CharCountIndicator
              current={draftText.length}
              max={ANSWER_MAX_LENGTH}
              colors={colors}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
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
  errorText: {
    marginBottom: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.thin,
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
    marginHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  scroll: {
    flex: 1,
  },
  rewardBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  rewardBannerContent: {
    flex: 1,
    gap: SPACING.xxs,
  },
  rewardBannerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  rewardBannerAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  heroHeader: {
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
  heroMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  statValue: {
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  charCount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  inputWrapper: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
  },
  input: {
    minHeight: 140,
    padding: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  discussionButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  discussionText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  responsesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  sectionMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  emptyResponseState: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  responseCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  responseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  responseAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  responseAuthor: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  pendingBadge: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontStyle: "italic",
  },
  responseDate: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  responseText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  bottomBar: {
    borderTopWidth: BORDER_WIDTH.thin,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  bottomBarContent: {
    gap: SPACING.xxs,
  },
  bottomBarInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
  },
  bottomInputWrapper: {
    flex: 1,
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.lg,
    maxHeight: 120,
  },
  bottomInput: {
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  sendButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  submittedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  submittedBarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
