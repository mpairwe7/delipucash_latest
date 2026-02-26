/**
 * AnimatedBalance — Smooth count-up/down balance display with WCAG 2.2 AA support.
 *
 * Inspired by Cash App / Revolut balance animations:
 * - Animated count between previous and new value
 * - Subtle pulse scale on change
 * - accessibilityLiveRegion="polite" for screen reader announcements
 *
 * Usage:
 *   <AnimatedBalance
 *     value={userPoints}
 *     formatFn={(n) => `${n} pts`}
 *     style={styles.balanceText}
 *   />
 */

import React, { useEffect, useRef } from 'react';
import { Text, type TextStyle, type StyleProp, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface AnimatedBalanceProps {
  /** Current numeric value to display */
  value: number;
  /** Format the numeric value into a display string (e.g. formatCurrency, `${n} pts`) */
  formatFn: (n: number) => string;
  /** Text style */
  style?: StyleProp<TextStyle>;
  /** Override the a11y label (defaults to formatFn(value)) */
  accessibilityLabel?: string;
  /** Animation duration in ms (default 600) */
  duration?: number;
}

/** Worklet-safe text updater using a regular Text with derived value */
const AnimatedBalanceInner = React.memo<AnimatedBalanceProps>(({
  value,
  formatFn,
  style,
  accessibilityLabel,
  duration = 600,
}) => {
  const animatedValue = useSharedValue(value);
  const scale = useSharedValue(1);
  const previousValueRef = useRef(value);

  useEffect(() => {
    if (value !== previousValueRef.current) {
      // Animate count
      animatedValue.value = withTiming(value, {
        duration,
        easing: Easing.out(Easing.cubic),
      });

      // Pulse scale on change
      scale.value = withSequence(
        withTiming(1.06, { duration: 150 }),
        withTiming(1, { duration: 200 }),
      );

      // WCAG 2.2 AA: announce balance change to screen readers
      const delta = value - previousValueRef.current;
      const direction = delta > 0 ? 'increased' : 'decreased';
      AccessibilityInfo.announceForAccessibility(
        `Balance ${direction} to ${formatFn(value)}`,
      );

      previousValueRef.current = value;
    }
  }, [value, duration, formatFn]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Since we can't directly render shared values in RN Text,
  // we use a state approach that syncs from the animation
  const [displayText, setDisplayText] = React.useState(formatFn(value));

  useDerivedValue(() => {
    const rounded = Math.round(animatedValue.value);
    runOnJS(setDisplayText)(formatFn(rounded));
    return rounded;
  });

  return (
    <Animated.View
      style={scaleStyle}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel || formatFn(value)}
    >
      <Text style={style}>{displayText}</Text>
    </Animated.View>
  );
});

AnimatedBalanceInner.displayName = 'AnimatedBalance';

export const AnimatedBalance = AnimatedBalanceInner;
