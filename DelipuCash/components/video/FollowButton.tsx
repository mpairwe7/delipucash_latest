/**
 * FollowButton — Reusable follow/unfollow button for video creators
 *
 * States: idle → following (pulse animation) → followed (checkmark)
 * Uses optimistic mutations from videoHooks.ts
 *
 * @module components/video/FollowButton
 */

import React, { memo, useCallback } from 'react';
import { StyleSheet, Pressable, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { UserPlus, UserCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, withAlpha } from '@/utils/theme';
import { useFollowCreator, useUnfollowCreator, useFollowStatus } from '@/services/videoHooks';
import { useAuthStore } from '@/utils/auth/store';
import { router } from 'expo-router';

// ============================================================================
// TYPES
// ============================================================================

export interface FollowButtonProps {
  creatorId: string;
  creatorName?: string;
  size?: 'sm' | 'md';
  variant?: 'filled' | 'outline';
  /** Override follow status (skip query) when parent already knows */
  isFollowingOverride?: boolean;
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SIZE_CONFIG = {
  sm: { height: 28, paddingH: SPACING.sm, iconSize: 14, fontSize: TYPOGRAPHY.fontSize.sm },
  md: { height: 36, paddingH: SPACING.base, iconSize: 16, fontSize: TYPOGRAPHY.fontSize.base },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

function FollowButtonComponent({
  creatorId,
  creatorName,
  size = 'sm',
  variant = 'filled',
  isFollowingOverride,
  testID,
}: FollowButtonProps): React.ReactElement | null {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((s) => !!s.token);

  // Only fetch status if no override provided
  const { data: followStatus } = useFollowStatus(
    isFollowingOverride === undefined ? creatorId : '',
  );
  const isFollowing = isFollowingOverride ?? followStatus?.isFollowing ?? false;

  const followMutation = useFollowCreator();
  const unfollowMutation = useUnfollowCreator();
  const isLoading = followMutation.isPending || unfollowMutation.isPending;

  // Animation
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isLoading) return;

    // Pulse animation
    scale.value = withSequence(
      withTiming(0.9, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );

    if (isFollowing) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      unfollowMutation.mutate(creatorId);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      followMutation.mutate(creatorId);
    }
  }, [isAuthenticated, isFollowing, isLoading, creatorId, followMutation, unfollowMutation, scale]);

  const config = SIZE_CONFIG[size];
  const isFilled = variant === 'filled';

  // Style variants
  const buttonBg = isFollowing
    ? withAlpha(colors.text, 0.12)
    : isFilled
      ? colors.primary
      : 'transparent';

  const borderColor = isFollowing
    ? withAlpha(colors.text, 0.2)
    : isFilled
      ? colors.primary
      : colors.primary;

  const textColor = isFollowing
    ? colors.textSecondary
    : isFilled
      ? '#FFFFFF'
      : colors.primary;

  const Icon = isFollowing ? UserCheck : UserPlus;
  const label = isFollowing ? 'Following' : 'Follow';

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={isLoading}
      style={[
        styles.button,
        animatedStyle,
        {
          height: config.height,
          paddingHorizontal: config.paddingH,
          backgroundColor: buttonBg,
          borderColor,
          borderWidth: isFilled && !isFollowing ? 0 : 1,
          opacity: isLoading ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isFollowing
          ? `Unfollow ${creatorName || 'creator'}`
          : `Follow ${creatorName || 'creator'}`
      }
      accessibilityState={{ selected: isFollowing }}
      testID={testID}
    >
      <Icon size={config.iconSize} color={textColor} strokeWidth={2} />
      <Text
        style={[
          styles.label,
          {
            fontSize: config.fontSize,
            color: textColor,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    minWidth: 48,
  },
  label: {
    fontFamily: TYPOGRAPHY.fonts.medium,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export const FollowButton = memo(FollowButtonComponent);
export default FollowButton;
