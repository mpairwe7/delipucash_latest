/**
 * QuestionDetailLayout - Shared layout for question detail screens
 *
 * Consolidates common patterns across:
 * - question/[id].tsx (answer a question)
 * - question-answer/[id].tsx (answer variant)
 * - question-detail.tsx (discussion/comments)
 * - reward-question/[id].tsx (reward question answering)
 *
 * Inspired by:
 * - Stack Overflow: Accepted answers, vote counts, reputation badges
 * - Quora: Clean layout, author info, follow
 * - Reddit: Engagement metrics, nested comments
 * - Brainly: Reward badges, gamification indicators
 *
 * Features:
 * - Shared header with back navigation
 * - Question card with badges, meta info, reward display
 * - Response list with like/dislike (optimistic)
 * - Answer input with validation and character count
 * - Error boundary wrapper
 * - Accessibility (WCAG 2.2 AA)
 */

import React, { memo, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  MessageSquare,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native';
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';
import { formatCurrency, formatDate } from '@/services/api';
import { PrimaryButton } from '@/components';
import { type Response } from '@/types';

// ===========================================
// Sub-Components
// ===========================================

interface ResponseCardProps {
  response: {
    id: string;
    userName: string;
    responseText: string;
    createdAt: string;
    likeCount: number;
    dislikeCount: number;
    isAccepted?: boolean;
  };
  isLiked?: boolean;
  isDisliked?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  colors: ThemeColors;
}

/**
 * Memoized response card with SO-style accepted answer badge
 */
export const ResponseCard = memo<ResponseCardProps>(
  ({ response, isLiked, isDisliked, onLike, onDislike, colors }) => {
    const likeCount = response.likeCount + (isLiked ? 1 : 0);
    const dislikeCount = response.dislikeCount + (isDisliked ? 1 : 0);

    return (
      <View
        style={[
          layoutStyles.responseCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={layoutStyles.responseHeader}>
          <View style={layoutStyles.responseAuthorRow}>
            <View
              style={[
                layoutStyles.responseAvatar,
                { backgroundColor: withAlpha(colors.primary, 0.15) },
              ]}
            >
              <Text style={[layoutStyles.responseAvatarText, { color: colors.primary }]}>
                {(response.userName || 'A').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={layoutStyles.responseAuthorInfo}>
              <Text style={[layoutStyles.responseAuthor, { color: colors.text }]}>
                {response.userName}
              </Text>
              <Text style={[layoutStyles.responseDate, { color: colors.textMuted }]}>
                {formatDate(response.createdAt)}
              </Text>
            </View>
            {response.isAccepted && (
              <View
                style={[
                  layoutStyles.acceptedBadge,
                  { backgroundColor: withAlpha(colors.success, 0.12) },
                ]}
              >
                <CheckCircle2 size={ICON_SIZE.xs} color={colors.success} strokeWidth={2} />
                <Text style={[layoutStyles.acceptedText, { color: colors.success }]}>
                  Accepted
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[layoutStyles.responseText, { color: colors.text }]}>
          {response.responseText}
        </Text>

        {(onLike || onDislike) && (
          <View style={layoutStyles.responseActions}>
            {onLike && (
              <TouchableOpacity
                style={layoutStyles.actionButton}
                onPress={() => onLike(response.id)}
                accessibilityRole="button"
                accessibilityLabel={`Like. ${likeCount} likes`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThumbsUp
                  size={ICON_SIZE.md}
                  color={isLiked ? colors.success : colors.textMuted}
                  strokeWidth={isLiked ? 2.5 : 1.5}
                />
                <Text
                  style={[
                    layoutStyles.actionText,
                    { color: isLiked ? colors.success : colors.textMuted },
                  ]}
                >
                  {likeCount}
                </Text>
              </TouchableOpacity>
            )}
            {onDislike && (
              <TouchableOpacity
                style={layoutStyles.actionButton}
                onPress={() => onDislike(response.id)}
                accessibilityRole="button"
                accessibilityLabel={`Dislike. ${dislikeCount} dislikes`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThumbsDown
                  size={ICON_SIZE.md}
                  color={isDisliked ? colors.error : colors.textMuted}
                  strokeWidth={isDisliked ? 2.5 : 1.5}
                />
                <Text
                  style={[
                    layoutStyles.actionText,
                    { color: isDisliked ? colors.error : colors.textMuted },
                  ]}
                >
                  {dislikeCount}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }
);
ResponseCard.displayName = 'ResponseCard';

// ===========================================
// Helper
// ===========================================

/**
 * Transform API response to display format.
 * Marks the highest-liked response as "accepted" (SO-style)
 * only if it has at least 1 like.
 */
export function transformResponses(responses: Response[] | undefined): ResponseCardProps['response'][] {
  if (!responses || responses.length === 0) return [];

  // Find the response with the most likes (must have > 0)
  let bestId: string | null = null;
  let bestLikes = 0;
  for (const r of responses) {
    const likes = r.likesCount ?? 0;
    if (likes > bestLikes) {
      bestLikes = likes;
      bestId = r.id;
    }
  }

  return responses.map((r) => ({
    id: r.id,
    userName: r.user
      ? `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() || 'Anonymous'
      : 'Anonymous',
    responseText: r.responseText,
    createdAt: r.createdAt,
    likeCount: r.likesCount ?? 0,
    dislikeCount: r.dislikesCount ?? 0,
    isAccepted: bestId !== null && r.id === bestId,
  }));
}

// ===========================================
// Shared Layout Props
// ===========================================

export interface QuestionDetailLayoutProps {
  /** Screen title */
  title: string;
  /** Subtitle shown under title */
  subtitle?: string;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if failed */
  error?: string | null;
  /** Question data */
  question?: {
    id: string;
    text: string;
    category?: string;
    rewardAmount?: number;
    isInstantReward?: boolean;
    createdAt: string;
    totalAnswers?: number;
  } | null;
  /** Children rendered after the question card */
  children?: ReactNode;
  /** Custom footer (for input bar, submit buttons, etc.) */
  footer?: ReactNode;
  /** Whether to use FlatList instead of ScrollView */
  useFlatList?: boolean;
  /** Pull-to-refresh handler */
  onRefresh?: () => void;
  /** Whether refreshing */
  isRefreshing?: boolean;
}

/**
 * Shared header component for all question detail screens
 */
export function QuestionDetailHeader({
  title,
  subtitle,
  onBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  rightAction?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        layoutStyles.header,
        {
          paddingTop: insets.top + SPACING.md,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <TouchableOpacity
        style={[layoutStyles.iconButton, { backgroundColor: colors.secondary }]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <ArrowLeft size={ICON_SIZE.md} color={colors.text} strokeWidth={1.5} />
      </TouchableOpacity>
      <View style={layoutStyles.headerCenter}>
        <Text style={[layoutStyles.headerTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text
            style={[layoutStyles.headerSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightAction}
    </View>
  );
}

/**
 * Shared question hero card
 */
export function QuestionHeroCard({
  question,
  badge,
  stats,
}: {
  question: NonNullable<QuestionDetailLayoutProps['question']>;
  badge?: ReactNode;
  stats?: ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        layoutStyles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={layoutStyles.heroHeader}>
        {badge || (
          <View style={[layoutStyles.badge, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
            <Sparkles size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
            <Text style={[layoutStyles.badgeText, { color: colors.primary }]}>
              {question.isInstantReward ? 'Instant' : question.category || 'Question'}
            </Text>
          </View>
        )}
        <Text style={[layoutStyles.heroMeta, { color: colors.textMuted }]}>
          {formatDate(question.createdAt)}
        </Text>
      </View>

      <Text style={[layoutStyles.questionText, { color: colors.text }]}>{question.text}</Text>

      {question.rewardAmount ? (
        <View
          style={[
            layoutStyles.rewardRow,
            { backgroundColor: withAlpha(colors.warning, 0.08) },
          ]}
        >
          <Award size={ICON_SIZE.md} color={colors.warning} strokeWidth={2} />
          <Text style={[layoutStyles.rewardText, { color: colors.warning }]}>
            Earn {formatCurrency(question.rewardAmount)}
          </Text>
        </View>
      ) : null}

      {stats || (
        <View style={layoutStyles.heroStats}>
          <View style={[layoutStyles.statCard, { backgroundColor: colors.secondary }]}>
            <MessageSquare size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
            <Text style={[layoutStyles.statLabel, { color: colors.textMuted }]}>
              {question.totalAnswers || 0} answers
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Loading state for question detail screens
 */
export function QuestionDetailLoading() {
  const { colors, statusBarStyle } = useTheme();
  return (
    <View style={[layoutStyles.centeredContainer, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[layoutStyles.loadingText, { color: colors.textMuted }]}>Loading…</Text>
    </View>
  );
}

/**
 * Error state for question detail screens
 */
export function QuestionDetailError({
  message = 'Question not found',
}: {
  message?: string;
}) {
  const { colors, statusBarStyle } = useTheme();
  return (
    <View style={[layoutStyles.centeredContainer, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <Text style={[layoutStyles.errorText, { color: colors.error }]}>{message}</Text>
      <PrimaryButton title="Go back" onPress={() => router.back()} variant="secondary" />
    </View>
  );
}

// ===========================================
// Answer Input Component
// ===========================================

interface AnswerInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Compact mode for bottom bar style */
  compact?: boolean;
}

export const AnswerInput = memo<AnswerInputProps>(
  ({
    value,
    onChangeText,
    onSubmit,
    isSubmitting = false,
    isSubmitted = false,
    maxLength = 500,
    placeholder = 'Share a thoughtful answer…',
    compact = false,
  }) => {
    const { colors } = useTheme();
    const remaining = Math.max(0, maxLength - value.length);
    const isValid = value.trim().length >= 10;

    if (compact) {
      return (
        <View style={layoutStyles.compactInputContainer}>
          <View
            style={[
              layoutStyles.compactInputWrapper,
              { borderColor: colors.border, backgroundColor: colors.secondary },
            ]}
          >
            <TextInput
              style={[layoutStyles.compactInput, { color: colors.text }]}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={value}
              onChangeText={onChangeText}
              multiline
              editable={!isSubmitting && !isSubmitted}
              accessibilityLabel="Answer input"
            />
          </View>
          <PrimaryButton
            title={isSubmitting ? 'Sending' : isSubmitted ? 'Sent' : 'Send'}
            onPress={onSubmit}
            disabled={!isValid || isSubmitting || isSubmitted}
            leftIcon={
              <Send size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={1.5} />
            }
            style={{ marginTop: SPACING.sm }}
          />
        </View>
      );
    }

    return (
      <View
        style={[layoutStyles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={layoutStyles.inputHeader}>
          <Text style={[layoutStyles.inputLabel, { color: colors.text }]}>Your Answer</Text>
          <Text style={[layoutStyles.charCount, { color: colors.textMuted }]}>
            {remaining} left
          </Text>
        </View>
        <View
          style={[
            layoutStyles.inputWrapper,
            { borderColor: colors.border, backgroundColor: colors.secondary },
          ]}
        >
          <TextInput
            style={[layoutStyles.input, { color: colors.text }]}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            value={value}
            onChangeText={onChangeText}
            maxLength={maxLength}
            textAlignVertical="top"
            editable={!isSubmitting && !isSubmitted}
            accessibilityLabel="Answer input"
          />
        </View>
        <PrimaryButton
          title={
            isSubmitting ? 'Submitting…' : isSubmitted ? 'Submitted!' : 'Submit Answer'
          }
          onPress={onSubmit}
          disabled={!isValid || isSubmitting || isSubmitted}
          leftIcon={
            <Send size={ICON_SIZE.sm} color={colors.primaryText} strokeWidth={1.5} />
          }
          style={{ marginTop: SPACING.md }}
        />
      </View>
    );
  }
);
AnswerInput.displayName = 'AnswerInput';

// ===========================================
// Styles
// ===========================================

const layoutStyles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: BORDER_WIDTH.thin,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Hero Card
  heroCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  heroStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Response Card
  responseCard: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  responseHeader: {
    marginBottom: SPACING.xs,
  },
  responseAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  responseAuthorInfo: {
    flex: 1,
  },
  responseAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  responseAvatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  responseAuthor: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  responseDate: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  acceptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.sm,
  },
  acceptedText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  responseText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  responseActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Input Card
  inputCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
    marginBottom: SPACING.lg,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  // Compact Input
  compactInputContainer: {
    paddingHorizontal: SPACING.lg,
  },
  compactInputWrapper: {
    borderWidth: BORDER_WIDTH.thin,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  compactInput: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    minHeight: COMPONENT_SIZE.input.small,
  },
});

export { layoutStyles };
