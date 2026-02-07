import { PrimaryButton } from "@/components";
import { formatCurrency, formatDate } from "@/services/api";
import { useQuestion, useSubmitResponse } from "@/services/hooks";
import {
  useQuestionAnswerStore,
  ANSWER_MAX_LENGTH,
  ANSWER_MIN_LENGTH,
  selectRemainingChars,
  selectWasSubmitted,
} from "@/store";
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
    MessageSquare,
    Send,
    Sparkles,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Memoized sub-components ─────────────────────────────────────────────────

interface ResponseItemProps {
  item: {
    id: string;
    user?: { firstName?: string; lastName?: string } | null;
    createdAt: string;
    responseText: string;
  };
  colors: Record<string, string>;
}

const ResponseItem = memo(function ResponseItem({ item, colors }: ResponseItemProps) {
  const authorName = useMemo(
    () =>
      item.user?.firstName
        ? `${item.user.firstName} ${item.user.lastName ?? ""}`.trim()
        : "Anonymous",
    [item.user?.firstName, item.user?.lastName]
  );

  return (
    <View style={[styles.responseCard, { borderColor: colors.border }]}>
      <View style={styles.responseHeader}>
        <Text style={[styles.responseAuthor, { color: colors.text }]}>{authorName}</Text>
        <Text style={[styles.responseDate, { color: colors.textMuted }]}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={[styles.responseText, { color: colors.text }]}>{item.responseText}</Text>
    </View>
  );
});

// ─── Main Screen Component ───────────────────────────────────────────────────

export default function QuestionAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionId = id || "";
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Zustand selectors (granular — avoid full-store re-renders) ──
  const draftText = useQuestionAnswerStore((s) => s.drafts[questionId]?.text ?? "");
  const remainingChars = useQuestionAnswerStore(selectRemainingChars(questionId));
  const wasSubmitted = useQuestionAnswerStore(selectWasSubmitted(questionId));
  const updateDraft = useQuestionAnswerStore((s) => s.updateDraft);
  const markSubmitted = useQuestionAnswerStore((s) => s.markSubmitted);
  const setActiveQuestion = useQuestionAnswerStore((s) => s.setActiveQuestion);

  // ── Server state ──
  const { data: question, isLoading, error, refetch } = useQuestion(questionId);
  const submitResponse = useSubmitResponse();

  // ── Derived (memoized) ──
  const responses = useMemo(() => question?.responses || [], [question?.responses]);

  // ── Effects ──
  useEffect(() => {
    if (questionId) setActiveQuestion(questionId);
  }, [questionId, setActiveQuestion]);

  // ── Callbacks (stable refs) ──
  const handleBack = useCallback((): void => {
    router.back();
  }, []);

  const handleDiscussion = useCallback((): void => {
    if (!question) return;
    router.push({ pathname: "/question-detail", params: { id: question.id } });
  }, [question]);

  const handleTextChange = useCallback(
    (text: string) => {
      updateDraft(questionId, text);
    },
    [questionId, updateDraft]
  );

  const handleSubmit = useCallback((): void => {
    if (!question || wasSubmitted) return;
    const trimmed = draftText.trim();
    if (trimmed.length < ANSWER_MIN_LENGTH) {
      Alert.alert(
        "Answer too short",
        `Please share a more detailed answer (at least ${ANSWER_MIN_LENGTH} characters).`
      );
      return;
    }

    submitResponse.mutate(
      { questionId: question.id, responseText: trimmed },
      {
        onSuccess: () => {
          markSubmitted(question.id);
          refetch();
          Alert.alert("Answer submitted", "Thanks for contributing!", [
            { text: "OK", onPress: handleBack },
          ]);
        },
        onError: () => {
          Alert.alert("Error", "Could not submit your answer. Please try again.");
        },
      }
    );
  }, [question, wasSubmitted, draftText, submitResponse, markSubmitted, refetch, handleBack, questionId]);

  // ── Render item for FlatList (stable ref) ──
  const renderResponse = useCallback(
    ({ item }: { item: any }) => <ResponseItem item={item} colors={colors} />,
    [colors]
  );
  const keyExtractor = useCallback((item: any) => item.id, []);

  // ── Loading state ──
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading question…</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error || !question) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Question not found</Text>
        <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
      </View>
    );
  }

  const isDisabled = submitResponse.isPending || wasSubmitted;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.secondary }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Answer question</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            Earn {formatCurrency(question.rewardAmount || 0)}
          </Text>
        </View>
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
      >
        {/* Hero card */}
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroHeader}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {question.isInstantReward ? "Instant" : "Standard"}
              </Text>
            </View>
            <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
              Posted {formatDate(question.createdAt)}
            </Text>
          </View>
          <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>
          <View style={styles.heroStats}>
            <View style={[styles.statCard, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reward</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(question.rewardAmount || 0)}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Responses</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{responses.length}</Text>
            </View>
          </View>
        </View>

        {/* Answer input card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.inputHeader}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Your answer</Text>
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{remainingChars} left</Text>
          </View>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Share a thoughtful, helpful answer…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={draftText}
              onChangeText={handleTextChange}
              maxLength={ANSWER_MAX_LENGTH}
              textAlignVertical="top"
              editable={!isDisabled}
            />
          </View>
          <PrimaryButton
            title={
              submitResponse.isPending
                ? "Submitting"
                : wasSubmitted
                ? "Submitted"
                : "Submit answer"
            }
            onPress={handleSubmit}
            disabled={isDisabled}
            leftIcon={<Send size={ICON_SIZE.sm} color={colors.primaryText} strokeWidth={1.5} />}
            style={{ marginTop: SPACING.md }}
          />
          <TouchableOpacity
            style={[styles.discussionButton, { borderColor: colors.border }]}
            onPress={handleDiscussion}
            accessibilityRole="button"
            accessibilityLabel="Open discussion"
          >
            <MessageSquare size={ICON_SIZE.sm} color={colors.text} strokeWidth={1.5} />
            <Text style={[styles.discussionText, { color: colors.text }]}>View discussion</Text>
          </TouchableOpacity>
        </View>

        {/* Previous responses */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.responsesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Responses</Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{responses.length} total</Text>
          </View>
          {responses.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No responses yet. Be the first.
            </Text>
          )}
          <FlatList
            data={responses}
            keyExtractor={keyExtractor}
            scrollEnabled={false}
            contentContainerStyle={{ gap: SPACING.md }}
            renderItem={renderResponse}
          />
        </View>
      </ScrollView>

      {/* ── FAB ───────────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: colors.primary, bottom: insets.bottom + SPACING.lg },
        ]}
        onPress={handleSubmit}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Submit answer"
      >
        {submitResponse.isPending ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : (
          <Send size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={1.5} />
        )}
      </TouchableOpacity>
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
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
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
  responseAuthor: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
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
  fab: {
    position: "absolute",
    right: SPACING.lg,
    width: COMPONENT_SIZE.button.large,
    height: COMPONENT_SIZE.button.large,
    borderRadius: COMPONENT_SIZE.button.large / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
});
