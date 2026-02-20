/**
 * Section Component
 * Reusable section wrapper with card styling and optional "See All" action
 * Follows design system guidelines for consistency
 *
 * @example
 * ```tsx
 * <Section
 *   title="Recent Questions"
 *   icon="comment-question"
 *   seeAllAction={() => router.push('/questions')}
 * >
 *   <QuestionCard ... />
 * </Section>
 * ```
 */

import React, { memo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
} from "@/utils/theme";
import { triggerHaptic } from '@/utils/quiz-utils';
import { getResponsiveSize, isTablet } from '@/utils/responsive';

export interface SectionProps {
  /** Section title */
  title: string;
  /** Children content */
  children: React.ReactNode;
  /** Icon name from MaterialCommunityIcons */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** "See All" press handler - shows action button when provided */
  seeAllAction?: () => void;
  /** Custom action text */
  actionText?: string;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Hide card background */
  transparent?: boolean;
  /** Animation delay */
  delay?: number;
  /** Test ID for testing */
  testID?: string;
}

export function Section({
  title,
  children,
  icon,
  seeAllAction,
  actionText = "See All",
  style,
  transparent = false,
  delay = 0,
  testID,
}: SectionProps): React.ReactElement {
  const { colors } = useTheme();

  const containerStyle = transparent
    ? [styles.containerTransparent, { marginHorizontal: isTablet ? 8 : 0 }]
    : [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          marginHorizontal: isTablet ? 8 : 0,
        },
      ];

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={[containerStyle, style]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {icon && (
            <View
              style={[
                styles.iconWrapper,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <MaterialCommunityIcons
                name={icon}
                size={getResponsiveSize(18, 20, 22)}
                color={colors.primary}
              />
            </View>
          )}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: getResponsiveSize(15, 16, 18),
              },
            ]}
          >
            {title}
          </Text>
        </View>
        {seeAllAction && (
          <Pressable
            onPress={() => {
              triggerHaptic('light');
              seeAllAction();
            }}
            style={styles.seeAllButton}
            accessibilityRole="button"
            accessibilityLabel={`${actionText} ${title}`}
            accessibilityHint={`Tap to see all ${title.toLowerCase()}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.seeAllText,
                {
                  color: colors.primary,
                  fontSize: getResponsiveSize(12, 13, 14),
                },
              ]}
            >
              {actionText}
            </Text>
            <Feather
              name="chevron-right"
              size={getResponsiveSize(14, 16, 18)}
              color={colors.primary}
            />
          </Pressable>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  containerTransparent: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.sm,
  },
  title: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "700",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  seeAllText: {
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.medium,
    fontWeight: "500",
    marginRight: 2,
  },
  content: {},
});

export default memo(Section);
