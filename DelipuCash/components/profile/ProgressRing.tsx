/**
 * ProgressRing Component
 * Animated circular progress indicator for streaks, milestones, and goals
 * 
 * Design: Duolingo + Apple Fitness inspired
 * Features:
 * - Smooth SVG-based ring animation
 * - Gradient fill support
 * - Center content slot
 * - Accessible with aria-valuenow/valuemin/valuemax
 * 
 * @example
 * ```tsx
 * <ProgressRing
 *   progress={0.75}
 *   size={100}
 *   strokeWidth={8}
 *   color="#4D4DFF"
 *   showPercentage
 * >
 *   <Text>75%</Text>
 * </ProgressRing>
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useTheme, TYPOGRAPHY, withAlpha } from '@/utils/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

export interface ProgressRingProps {
  /** Progress value from 0 to 1 */
  progress: number;
  /** Ring diameter in pixels */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Primary color or gradient start */
  color?: string;
  /** Gradient end color (optional) */
  gradientEndColor?: string;
  /** Background track color */
  trackColor?: string;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Whether to show percentage label */
  showPercentage?: boolean;
  /** Custom center content */
  children?: React.ReactNode;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Container style */
  style?: ViewStyle;
  /** Use spring animation instead of timing */
  useSpring?: boolean;
}

export function ProgressRing({
  progress,
  size = isSmallScreen ? 80 : 100,
  strokeWidth = 8,
  color,
  gradientEndColor,
  trackColor,
  animationDuration = 800,
  showPercentage = false,
  children,
  accessibilityLabel,
  style,
  useSpring: useSpringAnimation = true,
}: ProgressRingProps): React.ReactElement {
  const { colors } = useTheme();
  
  // Use theme colors if not provided
  const primaryColor = color || colors.primary;
  const endColor = gradientEndColor || withAlpha(primaryColor, 0.6);
  const bgTrackColor = trackColor || withAlpha(colors.border, 0.3);

  // Calculate ring dimensions
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated progress value
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    // Clamp progress between 0 and 1
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    
    if (useSpringAnimation) {
      animatedProgress.value = withSpring(clampedProgress, {
        damping: 15,
        stiffness: 100,
        mass: 1,
      });
    } else {
      animatedProgress.value = withTiming(clampedProgress, {
        duration: animationDuration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, useSpringAnimation, animationDuration]);

  // Animated stroke dashoffset
  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  const percentage = Math.round(progress * 100);
  const gradientIdRef = useRef(`gradient-${Math.random().toString(36).substr(2, 9)}`);
  const gradientId = gradientIdRef.current;

  return (
    <View
      style={[styles.container, { width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel || `Progress: ${percentage}%`}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: percentage,
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={primaryColor} />
            <Stop offset="100%" stopColor={endColor} />
          </LinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={bgTrackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress ring */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      {/* Center content */}
      <View style={styles.centerContent}>
        {children || (showPercentage && (
          <Text style={[styles.percentageText, { color: colors.text }]}>
            {percentage}%
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
});

export default ProgressRing;
