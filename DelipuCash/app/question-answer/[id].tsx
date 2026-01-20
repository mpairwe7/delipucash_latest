import { PrimaryButton } from "@/components";
import { formatCurrency, formatDate } from "@/data/mockData";
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
} from "lucide-react-native";
import React, { useMemo, useState } from "react";
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

export default function QuestionAnswerScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, statusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: question, isLoading, error, refetch } = useQuestion(id || "");
  const submitResponse = useSubmitResponse();

  const responses = useMemo(() => question?.responses || [], [question?.responses]);
  const remainingChars = Math.max(0, 500 - answer.length);

  const handleBack = (): void => {
    router.back();
  };

  const handleDiscussion = (): void => {
    if (!question) return;
    router.push(`/question-comments/${question.id}`);
  };

  const handleSubmit = (): void => {
    if (!question) return;
    const trimmed = answer.trim();
    if (trimmed.length < 10) {
      Alert.alert("Answer too short", "Please share a more detailed answer (at least 10 characters).");
      return;
    }

    submitResponse.mutate(
      { questionId: question.id, responseText: trimmed },
      {
        onSuccess: () => {
          setSubmitted(true);
          setAnswer("");
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
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading question…</Text>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Answer question</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            Earn {formatCurrency(question.rewardAmount || 0)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.heroHeader}>
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}> 
              <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                {question.isInstantReward ? "Instant" : "Standard"}
              </Text>
            </View>
            <Text style={[styles.heroMeta, { color: colors.textMuted }]}>Posted {formatDate(question.createdAt)}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.text }]}>{question.text}</Text>
          <View style={styles.heroStats}>
            <View style={[styles.statCard, { backgroundColor: colors.secondary }]}> 
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reward</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{formatCurrency(question.rewardAmount || 0)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.secondary }]}> 
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Responses</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{responses.length}</Text>
            </View>
          </View>
        </View>

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
              value={answer}
              onChangeText={setAnswer}
              maxLength={500}
              textAlignVertical="top"
              editable={!submitResponse.isPending && !submitted}
            />
          </View>
          <PrimaryButton
            title={submitResponse.isPending ? "Submitting" : submitted ? "Submitted" : "Submit answer"}
            onPress={handleSubmit}
            disabled={submitResponse.isPending || submitted}
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <View style={styles.responsesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Responses</Text>
            <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>{responses.length} total</Text>
          </View>
          {responses.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No responses yet. Be the first.</Text>
          )}
          <FlatList
            data={responses}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={{ gap: SPACING.md }}
            renderItem={({ item }) => (
              <View style={[styles.responseCard, { borderColor: colors.border }]}> 
                <View style={styles.responseHeader}>
                  <Text style={[styles.responseAuthor, { color: colors.text }]}>
                    {item.user?.firstName ? `${item.user.firstName} ${item.user.lastName ?? ""}`.trim() : "Anonymous"}
                  </Text>
                  <Text style={[styles.responseDate, { color: colors.textMuted }]}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[styles.responseText, { color: colors.text }]}>{item.responseText}</Text>
              </View>
            )}
          />
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: colors.primary, bottom: insets.bottom + SPACING.lg },
        ]}
        onPress={handleSubmit}
        disabled={submitResponse.isPending || submitted}
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
