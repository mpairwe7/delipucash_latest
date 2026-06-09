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
import { PostQuestionAdSlot } from "@/components/ads/PostQuestionAdSlot";
import { useQuizAdPlacement } from "@/hooks/useQuizAdPlacement";
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
  AccessibilityInfo,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
  /** Points the user earned for this answer (0 when the question carries no reward). */
  rewardEarned?: number;
}

const SubmittedBanner = memo(function SubmittedBanner({
  colors,
  rewardEarned = 0,
}: SubmittedBannerProps) {
  const success = colors.success || "#22c55e";
  const earned = rewardEarned > 0;
  const a11yLabel = earned
    ? `Answer submitted. You earned ${rewardEarned} points.`
    : "Answer submitted. Thanks for contributing.";

  return (
    <View
      style={[styles.rewardBanner, { backgroundColor: withAlpha(success, 0.12) }]}
      accessible
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11yLabel}
    >
      <CheckCircle size={ICON_SIZE.md} color={success} strokeWidth={1.5} />
      <View style={styles.rewardBannerContent}>
        <Text style={[styles.rewardBannerTitle, { color: success }]}>
          {earned ? `You earned ${rewardEarned} points!` : "Answer submitted!"}
        </Text>
        <Text style={[styles.rewardBannerAmount, { color: success }]}>
          {earned
            ? "Reward added to your points balance"
            : "Thanks for contributing to the community"}
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
  const scrollRef = useRef<FlatList>(null);
  const submitDebounceRef = useRef(false);
  const { data: user, loading: userLoading } = useUser();
  const isAuthenticated = !!user;
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  // Points earned for this answer — drives the reward acknowledgment banner.
  const [rewardEarned, setRewardEarned] = useState(0);

  // ── Zustand selectors (granular — avoid full-store re-renders) ──
  const draftText = useQuestionAnswerStore(
    (s) => s.drafts[questionId]?.text ?? ""
  );
  const isValidLength = useQuestionAnswerStore(selectIsValidLength(questionId));
  const wasSubmitted = useQuestionAnswerStore(selectWasSubmitted(questionId));
  const updateDraft = useQuestionAnswerStore((s) => s.updateDraft);
  const markSubmitted = useQuestionAnswerStore((s) => s.markSubmitted);
  const setActiveQuestion = useQuestionAnswerStore((s) => s.setActiveQuestion);

  // ── Quiz ad placement (post-submission ad below responses) ──
  const {
    postAnswerAd,
    shouldShowPostAnswerAd,
    recordQuestionAnswered,
    trackPostAnswerImpression,
  } = useQuizAdPlacement({
    contextType: 'questions',
    hasSubmitted: wasSubmitted,
  });

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

  // Stable FlatList callbacks — keep item identity across keystroke re-renders so the
  // (memoized) ResponseItem rows aren't re-rendered while typing in the answer input.
  const renderResponse = useCallback(
    ({ item }: { item: (typeof responses)[number] }) => (
      <View style={{ marginBottom: SPACING.md }}>
        <ResponseItem
          item={item}
          colors={colors}
          isOptimistic={item.id?.startsWith("optimistic_")}
        />
      </View>
    ),
    [colors]
  );
  const keyExtractor = useCallback((item: (typeof responses)[number]) => item.id, []);

  // ── Effects ──
  useEffect(() => {
    if (questionId) setActiveQuestion(questionId);
  }, [questionId, setActiveQuestion]);

  // Reflect "already answered" on load (not only after a failed submit). The server
  // seeds userHasResponded; we also derive it from the user's own response in the list
  // so the screen opens in submitted state for returning/cross-device users.
  useEffect(() => {
    if (!question || wasSubmitted) return;
    const myId = user?.id;
    const respondedOnServer = question.userHasResponded === true;
    const respondedInList =
      !!myId &&
      responses.some(
        (r) =>
          !r.id?.startsWith("optimistic_") &&
          ((r as { userId?: string }).userId ?? r.user?.id) === myId
      );
    if (respondedOnServer || respondedInList) {
      markSubmitted(questionId);
    }
  }, [question, wasSubmitted, responses, user?.id, questionId, markSubmitted]);

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

  // Post-submit "next" path — keep the answer-and-earn loop going instead of dead-ending.
  const handleBrowseMore = useCallback((): void => {
    triggerHaptic('light');
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/questions-new" as Href);
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
        onSuccess: (data) => {
          markSubmitted(question.id);
          submitDebounceRef.current = false;

          // Track question answered for ad frequency capping
          recordQuestionAnswered();

          // Surface the reward the answer actually earned (server credits points).
          const earned = data?.rewardEarned ?? 0;
          setRewardEarned(earned);

          // Scroll to bottom to see the new response
          scrollRef.current?.scrollToEnd({ animated: true });

          triggerHaptic('success');
          const message =
            earned > 0
              ? `Answer submitted — you earned ${earned} points!`
              : 'Answer submitted! Thanks for contributing your knowledge.';
          AccessibilityInfo.announceForAccessibility(message);
          showToast({
            message,
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
          // Detect already-answered via the stable server code, not the message text
          // (kept as a fallback for older server builds).
          const code = (err as Error & { code?: string })?.code;
          const alreadyResponded =
            code === "ALREADY_RESPONDED" ||
            err?.message === "You have already responded to this question";
          if (alreadyResponded) {
            // Server is the source of truth: mark this question submitted (also clears the
            // draft) so the UI reflects the answered state instead of inviting a retry.
            markSubmitted(question.id);
          }
          triggerHaptic(alreadyResponded ? 'warning' : 'error');
          const message = alreadyResponded
            ? "You've already answered this question."
            : "Could not submit your answer. Please try again.";
          AccessibilityInfo.announceForAccessibility(message);
          showToast({
            message,
            type: alreadyResponded ? 'info' : 'error',
          });
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
    recordQuestionAnswered,
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
        {(() => {
          // Distinguish a genuinely missing question from a load failure (offline /
          // server error) so a flaky-network user isn't told the question doesn't exist.
          const notFound = !error || /not\s*found/i.test(error.message || "");
          return (
            <>
              <Text style={[styles.errorText, { color: colors.error }]}>
                {notFound ? "Question not found" : "Couldn't load this question"}
              </Text>
              <Text style={[styles.errorSubtext, { color: colors.textMuted }]}>
                {notFound
                  ? "It may have been removed or is no longer available."
                  : "Check your connection and try again."}
              </Text>
            </>
          );
        })()}
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

      {/* ── Content (virtualized: responses are FlatList items; hero/footer are header/footer) ── */}
      <FlatList
        ref={scrollRef}
        style={styles.scroll}
        data={responses}
        keyExtractor={keyExtractor}
        renderItem={renderResponse}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: SPACING.lg,
        }}
        accessibilityRole="list"
        accessibilityLabel={`${responseCount} responses`}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={6}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyResponseState}>
            <MessageSquare size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No answers yet. Be the first to share your knowledge!
            </Text>
          </View>
        }
        ListHeaderComponent={
          <>
        {/* Submission confirmation banner */}
        {wasSubmitted && (
          <SubmittedBanner colors={colors} rewardEarned={rewardEarned} />
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

        {/* Responses section header */}
        <View style={styles.responsesHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Responses
          </Text>
          <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
            {responseCount} total
          </Text>
        </View>
          </>
        }
        ListFooterComponent={
          <>
        {/* Post-Submission Ad — shown after user submits their answer */}
        {wasSubmitted && shouldShowPostAnswerAd && (
          <PostQuestionAdSlot
            ad={postAnswerAd}
            onImpression={trackPostAnswerImpression}
          />
        )}

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
          </>
        }
      />

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
            <View style={styles.submittedBarStatus}>
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
            <Pressable
              style={[styles.browseMoreButton, { backgroundColor: colors.primary }]}
              onPress={handleBrowseMore}
              accessibilityRole="button"
              accessibilityLabel="Browse more questions"
              accessibilityHint="Returns to the questions feed to answer another"
              hitSlop={8}
            >
              <Text style={[styles.browseMoreText, { color: colors.primaryText }]}>
                Browse more questions
              </Text>
            </Pressable>
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
    justifyContent: "space-between",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  submittedBarStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  submittedBarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  browseMoreButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: COMPONENT_SIZE.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  browseMoreText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  errorSubtext: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    paddingHorizontal: SPACING.xl,
  },
});
