/**
 * NotificationBadge Component
 * Animated badge showing notification count
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { RADIUS, ANIMATION, useTheme } from '@/utils/theme';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
  animate?: boolean;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  size = 'md',
  showZero = false,
  animate = true,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(0);

  const sizeConfig = {
    sm: { minWidth: 16, height: 16, fontSize: 10, padding: 2 },
    md: { minWidth: 20, height: 20, fontSize: 11, padding: 4 },
    lg: { minWidth: 24, height: 24, fontSize: 12, padding: 6 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (count > 0 || showZero) {
      if (animate) {
        scale.value = withSequence(
          withSpring(1.2, { stiffness: 400, damping: 10 }),
          withSpring(1, { stiffness: 400, damping: 15 })
        );
      } else {
        scale.value = withTiming(1, { duration: ANIMATION.duration.fast });
      }
    } else {
      scale.value = withSpring(0, { stiffness: 400, damping: 15 });
    }
  }, [count, showZero, animate, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  if (count <= 0 && !showZero) {
    return null;
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const styles = StyleSheet.create({
    badge: {
      minWidth: config.minWidth,
      height: config.height,
      borderRadius: RADIUS.full,
      backgroundColor: colors.error,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: config.padding,
    },
    text: {
      fontSize: config.fontSize,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
  });

  return (
    <Animated.View style={[styles.badge, animatedStyle]}>
      <ThemedText style={styles.text}>{displayCount}</ThemedText>
    </Animated.View>
  );
};

export default NotificationBadge;
