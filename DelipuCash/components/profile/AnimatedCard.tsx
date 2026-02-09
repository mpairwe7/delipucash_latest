/**
 * AnimatedCard Component
 * Reusable card with Reanimated spring press effects and glassmorphism
 * 
 * Design: Material You + iOS HIG inspired
 * Features:
 * - Spring scale animation on press
 * - Glassmorphism/blur effect option
 * - Gradient accent support
 * - 44x44dp minimum touch target
 * - Full accessibility support
 * 
 * @example
 * ```tsx
 * <AnimatedCard
 *   onPress={() => navigateToDetails()}
 *   variant="elevated"
 *   gradientColors={['#4D4DFF', '#7C7CFF']}
 * >
 *   <Text>Card Content</Text>
 * </AnimatedCard>
 * ```
 */

import React, { useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  AccessibilityRole,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  FadeInDown,
  FadeInUp,
  Layout,
  ReduceMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  RADIUS,
  SHADOWS,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'gradient';

export interface AnimatedCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Card variant style */
  variant?: CardVariant;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Gradient colors (for gradient variant) */
  gradientColors?: readonly [string, string, ...string[]];
  /** Disable press animations */
  disabled?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Custom content style */
  contentStyle?: StyleProp<ViewStyle>;
  /** Entry animation delay (ms) */
  animationDelay?: number;
  /** Entry animation direction */
  animationDirection?: 'up' | 'down' | 'none';
  /** Haptic feedback type */
  hapticType?: 'light' | 'medium' | 'heavy' | 'none';
  /** Border radius size */
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
  /** Accessibility role */
  accessibilityRole?: AccessibilityRole;
  /** Test ID */
  testID?: string;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.8,
};

const BORDER_RADIUS_MAP: Record<string, number> = {
  sm: RADIUS.sm,
  md: RADIUS.md,
  lg: RADIUS.lg,
  xl: RADIUS.xl,
  '2xl': RADIUS['2xl'],
};

export function AnimatedCard({
  children,
  variant = 'default',
  onPress,
  onLongPress,
  gradientColors,
  disabled = false,
  style,
  contentStyle,
  animationDelay = 0,
  animationDirection = 'down',
  hapticType = 'light',
  borderRadius = 'xl',
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
}: AnimatedCardProps): React.ReactElement {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(0.97, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  }, [disabled, scale, pressed]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  }, [scale, pressed]);

  const handlePress = useCallback(() => {
    if (disabled || !onPress) return;
    
    if (hapticType !== 'none') {
      const hapticMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(hapticMap[hapticType]);
    }
    
    onPress();
  }, [disabled, onPress, hapticType]);

  const handleLongPress = useCallback(() => {
    if (disabled || !onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress();
  }, [disabled, onLongPress]);

  const animatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      pressed.value,
      [0, 1],
      [variant === 'elevated' ? 0.15 : 0.05, 0.05],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: scale.value }],
      shadowOpacity,
    };
  });

  const radius = BORDER_RADIUS_MAP[borderRadius];

  // Get variant-specific styles
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.card,
          borderWidth: 0,
          ...SHADOWS.lg,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'filled':
        return {
          backgroundColor: withAlpha(colors.primary, 0.08),
          borderWidth: 0,
        };
      case 'gradient':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          overflow: 'hidden',
        };
      default:
        return {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          ...SHADOWS.sm,
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Determine entry animation
  const getEnteringAnimation = () => {
    if (animationDirection === 'none') return undefined;
    const Animation = animationDirection === 'up' ? FadeInUp : FadeInDown;
    return Animation.delay(animationDelay).duration(400).springify().reduceMotion(ReduceMotion.System);
  };

  const cardContent = (
    <View style={[styles.content, contentStyle]}>
      {children}
    </View>
  );

  const isInteractive = onPress || onLongPress;

  const cardElement = (
    <AnimatedPressable
      style={[
        styles.container,
        variantStyles,
        { borderRadius: radius },
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPressIn={isInteractive ? handlePressIn : undefined}
      onPressOut={isInteractive ? handlePressOut : undefined}
      onPress={isInteractive ? handlePress : undefined}
      onLongPress={isInteractive ? handleLongPress : undefined}
      disabled={disabled || !isInteractive}
      accessible
      accessibilityRole={isInteractive ? accessibilityRole : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      {variant === 'gradient' && gradientColors ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: radius }]}
        >
          {cardContent}
        </LinearGradient>
      ) : (
        cardContent
      )}
    </AnimatedPressable>
  );

  // Wrap with entry animation if needed
  if (animationDirection !== 'none') {
    return (
      <Animated.View
        entering={getEnteringAnimation()}
        layout={Layout.springify().reduceMotion(ReduceMotion.System)}
      >
        {cardElement}
      </Animated.View>
    );
  }

  return cardElement;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  content: {
    padding: SPACING.lg,
  },
  gradient: {
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default AnimatedCard;
