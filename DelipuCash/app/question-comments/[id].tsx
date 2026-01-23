import { PrimaryButton, StatCard } from "@/components";
import { formatDate } from "@/data/mockData";
import { useQuestion, useSubmitResponse } from "@/services/hooks";
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
    ThumbsDown,
    ThumbsUp,
  Users,
} from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ResponseItem {
  id: string;
  userName: string;
  responseText: string;
  createdAt: string;
  likeCount: number;
  dislikeCount: number;
}

export default function QuestionCommentsScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});

  const {
    data: question,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuestion(id || "");
  const submitResponse = useSubmitResponse();

  const responses = useMemo<ResponseItem[]>(() => {
    if (!question?.responses) return [];
    return question.responses.map((r) => ({
      id: r.id,
      userName: r.user?.firstName ? `${r.user.firstName} ${r.user.lastName ?? ""}`.trim() : "Anonymous",
      responseText: r.responseText,
      createdAt: r.createdAt,
      likeCount: r.likesCount ?? 0,
      dislikeCount: r.dislikesCount ?? 0,
    }));
  }, [question]);

  const handleBack = (): void => {
    router.back();
  };

  const handleSubmit = (): void => {
    if (!text.trim() || !question) return;
    submitResponse.mutate(
      { questionId: question.id, responseText: text.trim() },
      {
        onSuccess: () => {
          setText("");
          refetch();
        },
      }
    );
  };

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
    setDisliked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      return next;
    });
  }, []);

  const toggleDislike = useCallback((id: string) => {
    setDisliked((prev) => ({ ...prev, [id]: !prev[id] }));
    setLiked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading discussion…</Text>
      </View>
    );
  }

  if (error || !question) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <Text style={[styles.errorText, { color: colors.error }]}>Question not found</Text>
        <PrimaryButton title="Go back" onPress={handleBack} variant="secondary" />
      </View>
    );
  }

  const renderResponse = ({ item }: { item: ResponseItem }): React.ReactElement => {
    const isLiked = liked[item.id];
    const isDisliked = disliked[item.id];
    const likeCount = item.likeCount + (isLiked ? 1 : 0);
    const dislikeCount = item.dislikeCount + (isDisliked ? 1 : 0);

    return (
      <View style={[styles.responseCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
        <View style={styles.responseHeader}>
          <Text style={[styles.responseAuthor, { color: colors.text }]}>{item.userName}</Text>
          <Text style={[styles.responseDate, { color: colors.textMuted }]}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={[styles.responseText, { color: colors.text }]}>{item.responseText}</Text>
        <View style={styles.responseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleLike(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Like response"
          >
            <ThumbsUp size={ICON_SIZE.md} color={isLiked ? colors.success : colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.actionText, { color: isLiked ? colors.success : colors.textMuted }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleDislike(item.id)}
            accessibilityRole="button"
            accessibilityLabel="Dislike response"
          >
            <ThumbsDown size={ICON_SIZE.md} color={isDisliked ? colors.error : colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.actionText, { color: isDisliked ? colors.error : colors.textMuted }]}>{dislikeCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <StatusBar style={statusBarStyle} />

      <View
        style={[styles.header, { paddingTop: insets.top + SPACING.md, borderBottomColor: colors.border, backgroundColor: colors.card }]}
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Discussion</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {question.text}
          </Text>
        </View>
      </View>

      <FlatList
        data={responses}
        keyExtractor={(item) => item.id}
        renderItem={renderResponse}
        style={styles.list}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + COMPONENT_SIZE.input.large }}
        ListHeaderComponent={
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <View style={styles.heroHeader}>
              <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
                <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>Question</Text>
              </View>
              <Text style={[styles.heroMeta, { color: colors.textMuted }]}>{formatDate(question.createdAt)}</Text>
            </View>
            <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>
            <View style={styles.heroStats}>
              <StatCard
                icon={<MessageSquare size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />}
                title="Responses"
                value={responses.length}
                subtitle="Total replies"
              />
              <StatCard
                icon={<Users size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />}
                title="Following"
                value={Math.floor(Math.random() * 50) + 5}
                subtitle="People interested"
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No responses yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Be the first to share a thoughtful answer.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

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
    paddingBottom: SPACING.sm,
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
  list: {
    flex: 1,
  },
  hero: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
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
  responseCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
  responseActions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
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
