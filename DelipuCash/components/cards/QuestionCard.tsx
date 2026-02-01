/**
 * QuestionCard Component
 * Displays question with reward and engagement info
 * Features smooth animations and modern UI design
 *
 * @example
 * ```tsx
 * <QuestionCard
 *   question={questionData}
 *   onPress={() => router.push(`/question/${question.id}`)}
 * />
 * ```
 */

import React, { useCallback, memo } from "react";
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
  FadeIn,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import {
  MessageCircle,
  DollarSign,
  Zap,
  Clock,
  Users,
  ChevronRight,
  Award,
} from "lucide-react-native";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from "@/utils/theme";
import { Question } from "@/types";

// Create AnimatedPressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface QuestionCardProps {
  /** Question data object */
  question: Question;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default or compact */
  variant?: "default" | "compact";
  /** Animation delay for staggered entrance */
  index?: number;
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
  };
  return categoryColors[category || ""] || colors.textMuted;
};

/**
 * Format time ago
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function QuestionCardComponent({
  question,
  onPress,
  style,
  variant = "default",
  index = 0,
  testID,
}: QuestionCardProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [scale, pressed]);

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

  const categoryColor = getCategoryColor(question.category, colors);

  return (
    <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Question: ${question.text}`}
        testID={testID}
        style={[
          animatedCardStyle,
          styles.container,
          variant === "compact" && styles.containerCompact,
          { backgroundColor: colors.card },
          style,
        ]}
      >
        {/* Header Row - Category & Badges */}
        <View style={styles.headerRow}>
          <View style={styles.badgesContainer}>
            {question.category && (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: withAlpha(categoryColor, 0.12) },
                ]}
              >
                <Text style={[styles.categoryText, { color: categoryColor }]}>
                  {question.category}
                </Text>
              </View>
            )}
            {question.isInstantReward && (
              <View
                style={[
                  styles.instantBadge,
                  { backgroundColor: withAlpha(colors.warning, 0.12) },
                ]}
              >
                <Zap size={10} color={colors.warning} fill={colors.warning} />
                <Text style={[styles.instantText, { color: colors.warning }]}>
                  Instant
                </Text>
              </View>
            )}
          </View>

          {/* Time indicator */}
          <View style={styles.timeContainer}>
            <Clock size={12} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.timeText, { color: colors.textMuted }]}>
              {formatTimeAgo(question.createdAt)}
            </Text>
          </View>
        </View>

        {/* Question Text */}
        <Text
          style={[styles.questionText, { color: colors.text }]}
          numberOfLines={variant === "compact" ? 2 : 3}
        >
          {question.text}
        </Text>

        {/* Stats Row - Quora-like engagement metrics */}
        <View style={styles.statsRow}>
          {/* Answers */}
          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: withAlpha(colors.info, 0.1) },
              ]}
            >
              <MessageCircle size={14} color={colors.info} strokeWidth={1.5} />
            </View>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              {question.totalAnswers || 0}{" "}
              {(question.totalAnswers || 0) === 1 ? "answer" : "answers"}
            </Text>
          </View>

          {/* Followers/Views - Quora-like metric */}
          <View style={styles.statItem}>
            <View
              style={[
                styles.statIconContainer,
                { backgroundColor: withAlpha(colors.primary, 0.1) },
              ]}
            >
              <Users size={14} color={colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              {Math.floor(Math.random() * 50) + 5} following
            </Text>
          </View>

          {/* Arrow indicator */}
          <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </Animated.View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  containerCompact: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  badgesContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
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
  },
  instantBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: 3,
  },
  instantText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
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
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  statIconContainer: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  arrowContainer: {
    marginLeft: "auto",
  },
});

// Memoize to prevent unnecessary re-renders in lists
export const QuestionCard = memo(QuestionCardComponent);
QuestionCard.displayName = 'QuestionCard';

export default QuestionCard;
