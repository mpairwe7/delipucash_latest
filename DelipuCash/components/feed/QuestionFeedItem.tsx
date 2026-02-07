/**
 * QuestionFeedItem Component
 * 
 * Industry-standard question card for feed display, inspired by:
 * - Quora: Clean typography, engagement metrics, follow button
 * - Brainly: Gamification badges, reward indicators, expert answers
 * - Stack Overflow: Vote count, accepted answer indicator, reputation
 * - Reddit: Compact engagement stats, time-sensitive badges
 * 
 * Features:
 * - Smooth press animations with reanimated
 * - Full accessibility support (WCAG 2.2 AA)
 * - Dynamic type scaling
 * - Reward amount with animated glow for instant rewards
 * - User reputation/badge display
 * - Vote count with optimistic updates
 * - Expert answer indicator
 * - Time-left countdown for reward questions
 * 
 * @example
 * ```tsx
 * <QuestionFeedItem
 *   question={question}
 *   onPress={() => router.push(`/question/${question.id}`)}
 *   onVote={(type) => handleVote(question.id, type)}
 *   showRewardGlow={true}
 * />
 * ```
 */

import React, { useCallback, useMemo, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  MessageCircle,
  Zap,
  Clock,
  ChevronRight,
  Award,
  ThumbsUp,
  ThumbsDown,
  Star,
  CheckCircle2,
  Crown,
  Flame,
  TrendingUp,
  Users,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  COMPONENT_SIZE,
  withAlpha,
} from "@/utils/theme";
import { Question } from "@/types";
import * as Haptics from "expo-haptics";

// Create AnimatedPressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Question author with reputation data
 */
export interface QuestionAuthor {
  id: string;
  name: string;
  avatar?: string;
  reputation?: number;
  badge?: "expert" | "top-contributor" | "verified" | "new";
  answersCount?: number;
}

/**
 * Extended question data for feed display
 */
export interface FeedQuestion extends Question {
  author?: QuestionAuthor;
  upvotes?: number;
  downvotes?: number;
  hasAcceptedAnswer?: boolean;
  hasExpertAnswer?: boolean;
  expiresAt?: string;
  isHot?: boolean;
  isTrending?: boolean;
  followersCount?: number;
  userHasVoted?: "up" | "down" | null;
  timeRemaining?: number; // seconds remaining for reward questions
}

export interface QuestionFeedItemProps {
  /** Question data object */
  question: FeedQuestion;
  /** Press handler for navigation (legacy — inline closure per item) */
  onPress?: () => void;
  /** ID-based press handler — stable reference, avoids inline closures in renderItem */
  onPressById?: (id: string, isInstantReward?: boolean) => void;
  /** Vote handler (legacy — inline closure per item) */
  onVote?: (type: "up" | "down") => void;
  /** ID-based vote handler — stable reference, avoids inline closures in renderItem */
  onVoteById?: (id: string, type: "up" | "down") => void;
  /** Follow question handler */
  onFollow?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default, compact, or featured */
  variant?: "default" | "compact" | "featured";
  /** Animation delay for staggered entrance */
  index?: number;
  /** Show animated glow for reward questions */
  showRewardGlow?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Spring animation config for press feedback
 */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

/**
 * Get category color based on category name
 */
const getCategoryColor = (
  category: string | undefined,
  colors: ReturnType<typeof useTheme>["colors"]
): string => {
  const categoryColors: Record<string, string> = {
    Technology: colors.info,
    Lifestyle: colors.success,
    Finance: colors.warning,
    Business: colors.primary,
    Health: "#10B981",
    Education: "#8B5CF6",
    Science: "#06B6D4",
    Sports: "#F97316",
    Entertainment: "#EC4899",
    General: colors.textMuted,
    Rewards: colors.warning,
  };
  return categoryColors[category || ""] || colors.textMuted;
};

/**
 * Format time ago with accessibility-friendly output
 */
const formatTimeAgo = (dateString: string): { display: string; accessible: string } => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return { display: "Just now", accessible: "just now" };
  if (diffMins < 60) return { display: `${diffMins}m`, accessible: `${diffMins} minutes ago` };
  if (diffHours < 24) return { display: `${diffHours}h`, accessible: `${diffHours} hours ago` };
  if (diffDays < 7) return { display: `${diffDays}d`, accessible: `${diffDays} days ago` };
  
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { display: formatted, accessible: `on ${formatted}` };
};

/**
 * Format time remaining for reward questions
 */
const formatTimeRemaining = (seconds: number): { display: string; accessible: string; urgency: "normal" | "warning" | "critical" } => {
  if (seconds <= 0) return { display: "Expired", accessible: "expired", urgency: "critical" };
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  let urgency: "normal" | "warning" | "critical" = "normal";
  if (seconds < 300) urgency = "critical"; // < 5 min
  else if (seconds < 3600) urgency = "warning"; // < 1 hour

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return { display: `${days}d left`, accessible: `${days} days remaining`, urgency };
  }
  if (hours > 0) {
    return { display: `${hours}h ${minutes}m`, accessible: `${hours} hours and ${minutes} minutes remaining`, urgency };
  }
  return { display: `${minutes}m`, accessible: `${minutes} minutes remaining`, urgency };
};

/**
 * Format reputation number
 */
const formatReputation = (rep: number): string => {
  if (rep >= 1000000) return `${(rep / 1000000).toFixed(1)}M`;
  if (rep >= 1000) return `${(rep / 1000).toFixed(1)}K`;
  return rep.toString();
};

/**
 * Get badge icon and color
 */
const getBadgeInfo = (badge: QuestionAuthor["badge"], colors: ReturnType<typeof useTheme>["colors"]) => {
  switch (badge) {
    case "expert":
      return { icon: Crown, color: colors.warning, label: "Expert" };
    case "top-contributor":
      return { icon: Star, color: colors.primary, label: "Top Contributor" };
    case "verified":
      return { icon: CheckCircle2, color: colors.success, label: "Verified" };
    default:
      return null;
  }
};

/**
 * Vote button component with haptic feedback
 */
const VoteButton = memo(function VoteButton({
  type,
  count,
  isActive,
  onPress,
  colors,
  accessibilityLabel,
}: {
  type: "up" | "down";
  count: number;
  isActive: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  accessibilityLabel: string;
}) {
  const Icon = type === "up" ? ThumbsUp : ThumbsDown;
  const activeColor = type === "up" ? colors.success : colors.error;
  const displayColor = isActive ? activeColor : colors.textMuted;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.voteButton}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon
        size={14}
        color={displayColor}
        strokeWidth={isActive ? 2.5 : 1.5}
        fill={isActive ? displayColor : "transparent"}
      />
      {count > 0 && (
        <Text style={[styles.voteCount, { color: displayColor }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
});

/**
 * QuestionFeedItem - Main component
 */
function QuestionFeedItemComponent({
  question,
  onPress,
  onPressById,
  onVote,
  onVoteById,
  onFollow,
  style,
  variant = "default",
  index = 0,
  showRewardGlow = false,
  testID,
}: QuestionFeedItemProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values — press feedback only (no entering/glow animations to keep list fast)
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Static glow instead of animated — eliminates long-lived Reanimated nodes per item
  const showGlow = showRewardGlow && question.isInstantReward && Boolean(question.rewardAmount);

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [scale, pressed]);

  // Prefer stable ID-based handlers; fall back to legacy closure props
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPressById) onPressById(question.id, question.isInstantReward);
    else onPress?.();
  }, [onPressById, onPress, question.id, question.isInstantReward]);

  const handleVoteUp = useCallback(() => {
    if (onVoteById) onVoteById(question.id, "up");
    else onVote?.("up");
  }, [onVoteById, onVote, question.id]);

  const handleVoteDown = useCallback(() => {
    if (onVoteById) onVoteById(question.id, "down");
    else onVote?.("down");
  }, [onVoteById, onVote, question.id]);

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          pressed.value,
          [0, 1],
          [0, 4],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(pressed.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
  }));

  // Derived values — memoized to avoid new object creation per render
  const categoryColor = useMemo(
    () => getCategoryColor(question.category, colors),
    [question.category, colors]
  );
  const timeAgo = useMemo(
    () => formatTimeAgo(question.createdAt),
    [question.createdAt]
  );
  const timeRemaining = useMemo(
    () => question.timeRemaining ? formatTimeRemaining(question.timeRemaining) : null,
    [question.timeRemaining]
  );
  const authorBadge = useMemo(
    () => question.author?.badge ? getBadgeInfo(question.author.badge, colors) : null,
    [question.author?.badge, colors]
  );

  // Accessibility label — granular deps instead of entire question object
  const accessibilityLabel = useMemo(() => {
    const parts = [
      `Question: ${question.text}`,
      question.category && `Category: ${question.category}`,
      question.author?.name && `Asked by ${question.author.name}`,
      (question.author?.reputation != null && question.author.reputation > 0) && `with ${question.author.reputation} reputation`,
      `${question.totalAnswers || 0} answers`,
      question.hasAcceptedAnswer && "Has accepted answer",
      question.hasExpertAnswer && "Has expert answer",
      question.isInstantReward && !!question.rewardAmount && `Reward: ${question.rewardAmount} points`,
      timeRemaining && `Time remaining: ${timeRemaining.accessible}`,
      `Posted ${timeAgo.accessible}`,
    ].filter(Boolean);
    return parts.join(". ");
  }, [
    question.text, question.category, question.author?.name,
    question.author?.reputation, question.totalAnswers,
    question.hasAcceptedAnswer, question.hasExpertAnswer,
    question.isInstantReward, question.rewardAmount,
    timeRemaining, timeAgo,
  ]);

  return (
    <View>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Double tap to view question details and answers"
        testID={testID}
        style={[
          animatedCardStyle,
          styles.container,
          variant === "compact" && styles.containerCompact,
          variant === "featured" && styles.containerFeatured,
          { backgroundColor: colors.card },
          style,
        ]}
      >
        {/* Reward Glow Effect — static opacity instead of animated to keep list performant */}
        {showGlow && (
          <View
            style={[
              styles.rewardGlow,
              { backgroundColor: withAlpha(colors.warning, 0.15), opacity: 0.5 },
            ]}
          />
        )}

        {/* Header Row - Badges, Time & Trending */}
        <View style={styles.headerRow}>
          <View style={styles.badgesContainer}>
            {/* Category Badge */}
            {question.category && (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: withAlpha(categoryColor, 0.12) },
                ]}
                accessibilityLabel={`Category: ${question.category}`}
              >
                <Text style={[styles.categoryText, { color: categoryColor }]}>
                  {question.category}
                </Text>
              </View>
            )}

            {/* Instant Reward Badge */}
            {question.isInstantReward && (
              <View
                style={[
                  styles.instantBadge,
                  { backgroundColor: withAlpha(colors.warning, 0.12) },
                ]}
                accessibilityLabel="Instant reward question"
              >
                <Zap size={10} color={colors.warning} fill={colors.warning} />
                <Text style={[styles.instantText, { color: colors.warning }]}>
                  Instant
                </Text>
              </View>
            )}

            {/* Hot/Trending Badge */}
            {(question.isHot || question.isTrending) && (
              <View
                style={[
                  styles.hotBadge,
                  { backgroundColor: withAlpha(colors.error, 0.12) },
                ]}
                accessibilityLabel={question.isHot ? "Hot question" : "Trending question"}
              >
                {question.isHot ? (
                  <Flame size={10} color={colors.error} fill={colors.error} />
                ) : (
                  <TrendingUp size={10} color={colors.error} />
                )}
                <Text style={[styles.hotText, { color: colors.error }]}>
                  {question.isHot ? "Hot" : "Trending"}
                </Text>
              </View>
            )}

            {/* Expert Answer Badge */}
            {question.hasExpertAnswer && (
              <View
                style={[
                  styles.expertBadge,
                  { backgroundColor: withAlpha(colors.primary, 0.12) },
                ]}
                accessibilityLabel="Has expert answer"
              >
                <Crown size={10} color={colors.primary} />
                <Text style={[styles.expertText, { color: colors.primary }]}>
                  Expert
                </Text>
              </View>
            )}
          </View>

          {/* Time Indicator or Countdown */}
          <View style={styles.timeContainer}>
            {timeRemaining ? (
              <View 
                style={[
                  styles.countdownContainer,
                  { 
                    backgroundColor: withAlpha(
                      timeRemaining.urgency === "critical" 
                        ? colors.error 
                        : timeRemaining.urgency === "warning" 
                          ? colors.warning 
                          : colors.info,
                      0.12
                    ),
                  },
                ]}
                accessibilityLabel={`Time remaining: ${timeRemaining.accessible}`}
              >
                <Clock 
                  size={10} 
                  color={
                    timeRemaining.urgency === "critical" 
                      ? colors.error 
                      : timeRemaining.urgency === "warning" 
                        ? colors.warning 
                        : colors.info
                  } 
                  strokeWidth={2} 
                />
                <Text 
                  style={[
                    styles.countdownText, 
                    { 
                      color: timeRemaining.urgency === "critical" 
                        ? colors.error 
                        : timeRemaining.urgency === "warning" 
                          ? colors.warning 
                          : colors.info,
                    },
                  ]}
                >
                  {timeRemaining.display}
                </Text>
              </View>
            ) : (
              <>
                <Clock size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text 
                  style={[styles.timeText, { color: colors.textMuted }]}
                  accessibilityLabel={`Posted ${timeAgo.accessible}`}
                >
                  {timeAgo.display}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Question Text */}
        <Text
          style={[styles.questionText, { color: colors.text }]}
          numberOfLines={variant === "compact" ? 2 : 3}
        >
          {question.text}
        </Text>

        {/* Reward Amount Display */}
        {question.isInstantReward && !!question.rewardAmount && variant !== "compact" && (
          <View 
            style={[
              styles.rewardRow,
              { backgroundColor: withAlpha(colors.warning, 0.08) },
            ]}
            accessibilityLabel={`Earn ${question.rewardAmount} points for answering`}
          >
            <Award size={16} color={colors.warning} strokeWidth={2} />
            <Text style={[styles.rewardText, { color: colors.warning }]}>
              Earn {question.rewardAmount} points
            </Text>
            {question.hasAcceptedAnswer && (
              <View style={styles.acceptedIndicator}>
                <CheckCircle2 size={12} color={colors.success} />
              </View>
            )}
          </View>
        )}

        {/* Author Row (for default/featured variants) */}
        {question.author && variant !== "compact" && (
          <View style={styles.authorRow}>
            {/* Avatar placeholder */}
            <View 
              style={[
                styles.avatarPlaceholder, 
                { backgroundColor: withAlpha(colors.primary, 0.15) },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {question.author.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.authorInfo}>
              <View style={styles.authorNameRow}>
                <Text style={[styles.authorName, { color: colors.text }]}>
                  {question.author.name}
                </Text>
                {authorBadge && (
                  <View 
                    style={[
                      styles.authorBadge,
                      { backgroundColor: withAlpha(authorBadge.color, 0.15) },
                    ]}
                  >
                    <authorBadge.icon size={10} color={authorBadge.color} />
                  </View>
                )}
              </View>
              {question.author.reputation != null && question.author.reputation > 0 && (
                <Text style={[styles.authorRep, { color: colors.textMuted }]}>
                  {formatReputation(question.author.reputation)} reputation
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Stats Row - Engagement Metrics */}
        <View style={styles.statsRow}>
          {/* Vote buttons (if vote handler provided) */}
          {(onVoteById || onVote) && (
            <View style={styles.voteContainer}>
              <VoteButton
                type="up"
                count={question.upvotes || 0}
                isActive={question.userHasVoted === "up"}
                onPress={handleVoteUp}
                colors={colors}
                accessibilityLabel={`Upvote. ${question.upvotes || 0} upvotes`}
              />
              <VoteButton
                type="down"
                count={question.downvotes || 0}
                isActive={question.userHasVoted === "down"}
                onPress={handleVoteDown}
                colors={colors}
                accessibilityLabel={`Downvote. ${question.downvotes || 0} downvotes`}
              />
            </View>
          )}

          {/* Answers count */}
          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: withAlpha(colors.info, 0.1) },
              ]}
            >
              <MessageCircle size={14} color={colors.info} strokeWidth={1.5} />
            </View>
            <Text 
              style={[styles.statText, { color: colors.textMuted }]}
              accessibilityLabel={`${question.totalAnswers || 0} answers`}
            >
              {question.totalAnswers || 0}{" "}
              {(question.totalAnswers || 0) === 1 ? "answer" : "answers"}
            </Text>
            {question.hasAcceptedAnswer && (
              <CheckCircle2 size={12} color={colors.success} style={styles.acceptedIcon} />
            )}
          </View>

          {/* Followers/Following */}
          {question.followersCount !== undefined && (
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: withAlpha(colors.primary, 0.1) },
                ]}
              >
                <Users size={14} color={colors.primary} strokeWidth={1.5} />
              </View>
              <Text 
                style={[styles.statText, { color: colors.textMuted }]}
                accessibilityLabel={`${question.followersCount} people following`}
              >
                {question.followersCount} following
              </Text>
            </View>
          )}

          {/* Arrow indicator */}
          <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </Animated.View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

/**
 * Custom comparator to avoid unnecessary re-renders when list state changes
 * but the question payload is unchanged. This keeps VirtualizedList fast.
 */
const areEqualQuestionFeedItem = (
  prev: Readonly<QuestionFeedItemProps>,
  next: Readonly<QuestionFeedItemProps>
) => {
  const prevQ = prev.question;
  const nextQ = next.question;

  if (prevQ.id !== nextQ.id) return false;
  if (prev.variant !== next.variant) return false;
  if (prev.index !== next.index) return false;
  if (prev.showRewardGlow !== next.showRewardGlow) return false;
  if (prev.onPressById !== next.onPressById) return false;
  if (prev.onVoteById !== next.onVoteById) return false;

  const fields: Array<keyof typeof prevQ> = [
    "text",
    "updatedAt",
    "totalAnswers",
    "upvotes",
    "downvotes",
    "rewardAmount",
    "isInstantReward",
    "category",
    "viewCount",
    "userHasVoted",
    "hasAcceptedAnswer",
    "hasExpertAnswer",
    "followersCount",
    "isHot",
    "isTrending",
    "timeRemaining",
  ];

  for (const field of fields) {
    if (prevQ?.[field] !== nextQ?.[field]) return false;
  }

  const prevAuthor = prevQ.author;
  const nextAuthor = nextQ.author;

  if (!!prevAuthor !== !!nextAuthor) return false;
  if (prevAuthor && nextAuthor) {
    if (
      prevAuthor.id !== nextAuthor.id ||
      prevAuthor.name !== nextAuthor.name ||
      prevAuthor.badge !== nextAuthor.badge ||
      prevAuthor.reputation !== nextAuthor.reputation
    ) {
      return false;
    }
  }

  return true;
};

export const QuestionFeedItem = memo(
  QuestionFeedItemComponent,
  areEqualQuestionFeedItem
);

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  containerCompact: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  containerFeatured: {
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "transparent", // Will be set dynamically
  },
  rewardGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
    gap: SPACING.xs,
  },
  badgesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    flexWrap: "wrap",
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  categoryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: "capitalize",
  },
  instantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  instantText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  hotBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  hotText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  expertBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  expertText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  timeText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  countdownText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.sm,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  acceptedIndicator: {
    marginLeft: "auto",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  authorInfo: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  authorName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  authorBadge: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  authorRep: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  voteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginRight: SPACING.sm,
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
    justifyContent: "center",
  },
  voteCount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  statIconContainer: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  acceptedIcon: {
    marginLeft: 2,
  },
  arrowContainer: {
    marginLeft: "auto",
  },
});

export default QuestionFeedItem;
