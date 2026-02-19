import { PrimaryButton, StatCard } from "@/components";
import {
  QuestionDetailHeader,
  QuestionHeroCard,
  QuestionDetailError,
  ResponseCard,
  transformResponses,
} from "@/components/question";
import { QuestionDetailSkeleton } from "@/components/question/QuestionSkeletons";
import { useQuestionDetail, useSubmitQuestionResponse } from "@/services/questionHooks";
import { useLikeResponse, useDislikeResponse } from "@/services/hooks";
import { triggerHaptic } from "@/utils/quiz-utils";
import { useToast } from "@/components/ui/Toast";
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
} from "@/utils/theme";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MessageSquare, RefreshCw, Send } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function QuestionCommentsScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [text, setText] = useState("");
  // Track optimistic like/dislike state locally until server confirms
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});

  // Use dedicated question detail hook with optimistic updates
  const {
    data: question,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuestionDetail(id || "");

  // Use proper mutation hooks that hit the real API
  const submitResponse = useSubmitQuestionResponse();
  const likeResponse = useLikeResponse();
  const dislikeResponse = useDislikeResponse();

  // Use shared transform for consistent response formatting
  const responses = useMemo(() => {
    return transformResponses(question?.responses);
  }, [question]);

  // Sync like/dislike state from server when data changes (e.g. after refetch)
  useEffect(() => {
    if (!responses.length) return;
    const serverLiked: Record<string, boolean> = {};
    const serverDisliked: Record<string, boolean> = {};
    for (const r of responses) {
      if (r.isLikedByUser) serverLiked[r.id] = true;
      if (r.isDislikedByUser) serverDisliked[r.id] = true;
    }
    setLiked(serverLiked);
    setDisliked(serverDisliked);
  }, [responses]);

  const handleBack = useCallback((): void => {
    triggerHaptic('light');
    router.back();
  }, []);

  const handleSubmit = useCallback((): void => {
    if (!text.trim() || !question) return;
    triggerHaptic('medium');
    submitResponse.mutate(
      { questionId: question.id, responseText: text.trim() },
      {
        onSuccess: () => {
          setText("");
          triggerHaptic('success');
          showToast({ message: 'Response submitted!', type: 'success' });
        },
        onError: () => {
          triggerHaptic('error');
          showToast({ message: 'Failed to send. Please try again.', type: 'error' });
        },
      }
    );
  }, [text, question, submitResponse, showToast]);

  const toggleLike = useCallback((responseId: string) => {
    triggerHaptic('light');
    setLiked((prev) => ({ ...prev, [responseId]: !prev[responseId] }));
    setDisliked((prev) => {
      const next = { ...prev };
      if (next[responseId]) delete next[responseId];
      return next;
    });
    // Fire real API mutation
    if (question) {
      likeResponse.mutate({ responseId, questionId: question.id });
    }
  }, [question, likeResponse]);

  const toggleDislike = useCallback((responseId: string) => {
    triggerHaptic('light');
    setDisliked((prev) => ({ ...prev, [responseId]: !prev[responseId] }));
    setLiked((prev) => {
      const next = { ...prev };
      if (next[responseId]) delete next[responseId];
      return next;
    });
    // Fire real API mutation
    if (question) {
      dislikeResponse.mutate({ responseId, questionId: question.id });
    }
  }, [question, dislikeResponse]);

  // Memoized renderItem — stable reference for FlatList
  const renderResponse = useCallback(({ item }: { item: ReturnType<typeof transformResponses>[number] }) => (
    <ResponseCard
      response={item}
      isLiked={liked[item.id]}
      isDisliked={disliked[item.id]}
      onLike={toggleLike}
      onDislike={toggleDislike}
      colors={colors}
    />
  ), [liked, disliked, toggleLike, toggleDislike, colors]);

  const keyExtractor = useCallback((item: ReturnType<typeof transformResponses>[number]) => item.id, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <QuestionDetailSkeleton />
      </View>
    );
  }

  if (error || !question) {
    return (
      <QuestionDetailError
        message="Question not found"
        onRetry={() => { triggerHaptic('light'); refetch(); }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <QuestionDetailHeader
        title="Discussion"
        subtitle={question.text}
        onBack={handleBack}
      />

      <FlatList
        data={responses}
        keyExtractor={keyExtractor}
        renderItem={renderResponse}
        style={styles.list}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + COMPONENT_SIZE.input.large }}
        accessibilityRole="list"
        accessibilityLabel="Question responses"
        ListHeaderComponent={
          <QuestionHeroCard
            question={question}
            stats={
              <View style={styles.heroStats}>
                <StatCard
                  icon={<MessageSquare size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
                  title="Responses"
                  value={responses.length}
                  subtitle="Total replies"
                />
              </View>
            }
          />
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MessageSquare size={ICON_SIZE['3xl']} color={colors.textMuted} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No responses yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Be the first to share a thoughtful answer.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => { triggerHaptic('light'); refetch(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={6}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + COMPONENT_SIZE.touchTarget}
      >

      <View
        style={[
          styles.inputBar,
          {
            paddingBottom: insets.bottom + SPACING.sm,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Write your answer…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            accessibilityLabel="Answer input"
          />
        </View>
        <PrimaryButton
          title={submitResponse.isPending ? "Sending" : "Send"}
          onPress={handleSubmit}
          disabled={!text.trim() || submitResponse.isPending}
          leftIcon={<Send size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={1.5} />}
          style={{ marginTop: SPACING.sm }}
        />
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  heroStats: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  empty: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.xs,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.4,
  },
  inputBar: {
    borderTopWidth: BORDER_WIDTH.thin,
    paddingHorizontal: SPACING.lg,
  },
  inputWrapper: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  input: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.small,
  },
});
