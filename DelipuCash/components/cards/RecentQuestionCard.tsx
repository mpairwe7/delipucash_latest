/**
 * RecentQuestionCard Component
 * Enhanced question card specifically for home screen display
 * Features user avatar, stats, and modern UI design
 *
 * @example
 * ```tsx
 * <RecentQuestionCard
 *   question={questionData}
 *   onPress={() => router.push(`/question/${question.id}`)}
 * />
 * ```
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

const { width } = Dimensions.get("window");
const isTablet = width >= 768;
const isSmallScreen = width < 375;

export interface RecentQuestionCardProps {
  /** Question data object */
  question: Question;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
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
 * Get responsive size based on screen dimensions
 */
const getResponsiveSize = (small: number, medium: number, large: number): number => {
  if (isTablet) return large;
  if (isSmallScreen) return small;
  return medium;
};

/**
 * Format date to relative time
 */
const formatDate = (date: string | Date | undefined): string => {
  if (!date) return "";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

export function RecentQuestionCard({
  question,
  onPress,
  style,
  index = 0,
  testID,
}: RecentQuestionCardProps): React.ReactElement {
  const { colors } = useTheme();

  // Animation values
  const scale = useSharedValue(1);

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Get user initial
  const userInitial = question.user?.firstName
    ? question.user.firstName.charAt(0).toUpperCase()
    : "A";

  const userName = question.user?.firstName || "Anonymous";

  return (
      <AnimatedPressable
      entering={FadeIn.delay(index * 80).duration(400)}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Question: ${question.text}`}
        testID={testID}
        style={[
          animatedCardStyle,
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        {/* Left accent border */}
        <View style={[styles.accentBorder, { backgroundColor: colors.primary }]} />

        {/* Content */}
        <View style={styles.content}>
          {/* Header - User info and timestamp */}
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.primary,
                    width: getResponsiveSize(28, 32, 36),
                    height: getResponsiveSize(28, 32, 36),
                    borderRadius: getResponsiveSize(14, 16, 18),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarText,
                    { fontSize: getResponsiveSize(11, 12, 14) },
                  ]}
                >
                  {userInitial}
                </Text>
              </View>
              <Text
                style={[
                  styles.userName,
                  {
                    color: colors.textSecondary,
                    fontSize: getResponsiveSize(12, 13, 14),
                  },
                ]}
              >
                {userName}
              </Text>
            </View>
            <View style={styles.timestampContainer}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={getResponsiveSize(12, 14, 16)}
                color={colors.textMuted}
              />
              <Text
                style={[
                  styles.timestamp,
                  {
                    color: colors.textMuted,
                    fontSize: getResponsiveSize(10, 11, 12),
                  },
                ]}
              >
                {formatDate(question.createdAt)}
              </Text>
            </View>
          </View>

          {/* Question text */}
          <Text
            style={[
              styles.questionText,
              {
                color: colors.text,
                fontSize: getResponsiveSize(13, 14, 16),
              },
            ]}
            numberOfLines={2}
          >
            {question.text}
          </Text>

          {/* Footer - Stats */}
          <View style={styles.footer}>
            <View style={styles.stat}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: withAlpha(colors.info, 0.1) },
                ]}
              >
                <MaterialCommunityIcons
                  name="comment-outline"
                  size={getResponsiveSize(12, 14, 16)}
                  color={colors.info}
                />
              </View>
              <Text
                style={[
                  styles.statText,
                  {
                    color: colors.textMuted,
                    fontSize: getResponsiveSize(10, 11, 12),
                  },
                ]}
              >
                {question.totalAnswers || 0} answers
              </Text>
            </View>
            <View style={styles.stat}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: withAlpha(colors.textMuted, 0.1) },
                ]}
              >
                <MaterialCommunityIcons
                  name="eye-outline"
                  size={getResponsiveSize(12, 14, 16)}
                  color={colors.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.statText,
                  {
                    color: colors.textMuted,
                    fontSize: getResponsiveSize(10, 11, 12),
                  },
                ]}
              >
                {question.viewCount || 0} views
              </Text>
            </View>
            {question.rewardAmount && question.rewardAmount > 0 && (
              <View style={styles.rewardBadge}>
                <MaterialCommunityIcons
                  name="gift-outline"
                  size={getResponsiveSize(10, 12, 14)}
                  color={colors.success}
                />
                <Text
                  style={[
                    styles.rewardText,
                    {
                      color: colors.success,
                      fontSize: getResponsiveSize(10, 11, 12),
                    },
                  ]}
                >
                  ${question.rewardAmount.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Arrow indicator */}
        <View style={styles.arrowContainer}>
          <MaterialCommunityIcons
            name="chevron-right"
            size={getResponsiveSize(18, 20, 24)}
            color={colors.textMuted}
          />
        </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  accentBorder: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
  },
  userName: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "500",
  },
  timestampContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timestamp: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.regular,
  },
  questionText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  statText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.regular,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  rewardText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
  },
  arrowContainer: {
    justifyContent: "center",
    paddingRight: SPACING.sm,
  },
});

export default RecentQuestionCard;
