/**
 * ExploreCard Component
 * Modern explore section card with gradient backgrounds and animations
 * Follows design system guidelines for consistency
 *
 * @example
 * ```tsx
 * <ExploreCard
 *   icon="compass"
 *   title="Discover"
 *   description="Find new content"
 *   colors={['#FF6B6B', '#FF8E53']}
 *   onPress={() => handlePress()}
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
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
} from "@/utils/theme";

// Create AnimatedPressable
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

import { getResponsiveSize } from '@/utils/responsive';

export interface ExploreCardProps {
  /** Icon name from MaterialCommunityIcons */
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Card title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Gradient colors array */
  colors: readonly [string, string, ...string[]];
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Animation delay for staggered entrance */
  index?: number;
  /** Card variant */
  variant?: "default" | "compact";
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

export function ExploreCard({
  icon,
  title,
  description,
  colors,
  onPress,
  style,
  index = 0,
  variant = "default",
  testID,
}: ExploreCardProps): React.ReactElement {
  useTheme(); // Ensure theme context is available

  // Animation values
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  // Press handlers with haptic feedback
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }, [onPress]);

  // Animated styles
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0, 0.1], Extrapolation.CLAMP),
  }));

  const cardHeight = variant === "compact" 
    ? getResponsiveSize(70, 80, 100)
    : getResponsiveSize(80, 100, 120);

  const iconSize = variant === "compact"
    ? getResponsiveSize(20, 24, 28)
    : getResponsiveSize(24, 32, 40);

  const titleSize = variant === "compact"
    ? getResponsiveSize(11, 12, 14)
    : getResponsiveSize(12, 14, 16);

  return (
    <Animated.View 
      entering={FadeIn.delay(index * 80).duration(400)}
      style={[styles.wrapper, style]}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={description || `Navigate to ${title}`}
        testID={testID}
        style={[animatedCardStyle, styles.pressable]}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradient,
            { height: cardHeight },
          ]}
        >
          {/* Press overlay */}
          <Animated.View style={[styles.pressOverlay, animatedOverlayStyle]} />

          {/* Content */}
          <View style={styles.content}>
            <View style={[styles.iconContainer, { 
              width: iconSize + 16, 
              height: iconSize + 16,
            }]}>
              <MaterialCommunityIcons
                name={icon}
                size={iconSize}
                color="white"
              />
            </View>
            <Text
              style={[
                styles.title,
                { fontSize: titleSize },
                variant === "compact" && styles.titleCompact,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {description && variant !== "compact" && (
              <Text
                style={[
                  styles.description,
                  { fontSize: getResponsiveSize(9, 10, 12) },
                ]}
                numberOfLines={2}
              >
                {description}
              </Text>
            )}
          </View>

          {/* Decorative elements */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  pressable: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  gradient: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    ...SHADOWS.md,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    borderRadius: RADIUS.lg,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  iconContainer: {
    borderRadius: RADIUS.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.bold,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleCompact: {
    marginTop: SPACING.xxs,
  },
  description: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: Platform.OS === "ios" ? "System" : TYPOGRAPHY.fontFamily.regular,
    textAlign: "center",
    marginTop: SPACING.xxs,
    paddingHorizontal: SPACING.xs,
  },
  decorativeCircle1: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -15,
    left: -15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});

export default ExploreCard;
