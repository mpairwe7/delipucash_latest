/**
 * CreatorAvatarButton — TikTok-style avatar + follow badge for video feeds
 *
 * Renders a circular creator avatar in the right-side action column with
 * an animated red "+" badge overlay. Tapping the badge follows the creator;
 * tapping the avatar navigates to their profile; long-pressing unfollows.
 *
 * Performance-critical design:
 * - Follow/unfollow mutations lifted to parent via `onFollow`/`onUnfollow`
 *   callbacks to avoid per-item useMutation instantiation.
 * - Badge visibility decoupled from server state via local `showBadge` to
 *   allow exit animations to complete before unmount.
 * - Shared values reset on badge re-mount (undo follow → badge reappears).
 * - Effects guarded with value comparisons to prevent re-render cascades.
 *
 * @module components/video/CreatorAvatarButton
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  FadeIn,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import { TYPOGRAPHY } from '@/utils/theme';
import { useAuthStore } from '@/utils/auth/store';
import { router } from 'expo-router';

// ============================================================================
// TYPES
// ============================================================================

export interface CreatorAvatarButtonProps {
  creatorId: string;
  creatorName?: string;
  avatarUrl?: string | null;
  /** Whether user is currently following this creator (driven by parent/query) */
  isFollowing?: boolean;
  /** Whether a follow/unfollow mutation is in flight */
  isFollowLoading?: boolean;
  /** Follow callback — parent handles mutation + toast */
  onFollow: (creatorId: string) => void;
  /** Unfollow callback — parent handles mutation + toast */
  onUnfollow: (creatorId: string) => void;
  /** Navigate to creator profile */
  onProfilePress?: (creatorId: string) => void;
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AVATAR_SIZE = 46;
const AVATAR_BORDER = 2;
const AVATAR_OUTER = AVATAR_SIZE + AVATAR_BORDER * 2; // 50
const BADGE_SIZE = 20;
const TIKTOK_RED = '#FE2C55';
const PRIMARY_FALLBACK = 'rgba(99,102,241,0.6)'; // theme-independent fallback

// ============================================================================
// COMPONENT
// ============================================================================

function CreatorAvatarButtonComponent({
  creatorId,
  creatorName,
  avatarUrl,
  isFollowing = false,
  isFollowLoading = false,
  onFollow,
  onUnfollow,
  onProfilePress,
  testID,
}: CreatorAvatarButtonProps): React.ReactElement {
  const isAuthenticated = useAuthStore((s) => !!s.auth?.token);

  // ---------------------------------------------------------------------------
  // Local badge visibility — decoupled from props to allow exit animation
  // ---------------------------------------------------------------------------
  const [showBadge, setShowBadge] = useState(!isFollowing);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsFollowingRef = useRef(isFollowing);

  // Sync badge with isFollowing prop changes — guarded to prevent no-op setState
  useEffect(() => {
    if (isFollowing === prevIsFollowingRef.current) return;
    prevIsFollowingRef.current = isFollowing;

    if (isFollowing) {
      // External follow (undo, SSE, query refetch) → hide badge
      setShowBadge(false);
    } else {
      // Unfollow → show badge (enters with FadeIn)
      setShowBadge(true);
    }
  }, [isFollowing]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
    };
  }, []);

  // Avatar image error fallback
  const [imageError, setImageError] = useState(false);
  const showFallback = !avatarUrl || imageError;

  // Shared animation values
  const avatarScale = useSharedValue(1);
  const borderColorProgress = useSharedValue(0);
  const badgeScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(1);

  // Reset badge shared values when badge re-mounts
  useEffect(() => {
    if (showBadge) {
      badgeScale.value = 1;
      badgeOpacity.value = 1;
    }
  }, [showBadge, badgeScale, badgeOpacity]);

  // Animated styles — border color only interpolates when animating (progress !== 0)
  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
    borderColor: borderColorProgress.value === 0
      ? '#FFFFFF'
      : interpolateColor(borderColorProgress.value, [0, 1], ['#FFFFFF', TIKTOK_RED]),
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    opacity: badgeOpacity.value,
  }));

  // Memoized display values
  const initial = useMemo(
    () => (creatorName || 'U').charAt(0).toUpperCase(),
    [creatorName],
  );

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const hideBadge = useCallback(() => setShowBadge(false), []);

  // Follow — tap "+" badge
  const handleFollowPress = useCallback(() => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    if (isFollowLoading) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Badge pop + shrink
    badgeScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 300 }),
      withDelay(400, withTiming(0, { duration: 150 })),
    );
    badgeOpacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(500, withTiming(0, { duration: 100 }, () => {
        runOnJS(hideBadge)();
      })),
    );

    // Avatar border flash
    borderColorProgress.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(300, withTiming(0, { duration: 300 })),
    );

    // Delegate to parent after animation settles
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      onFollow(creatorId);
    }, 600);
  }, [isAuthenticated, isFollowLoading, creatorId, onFollow, hideBadge, badgeScale, badgeOpacity, borderColorProgress]);

  // Unfollow — long-press avatar
  const handleLongPress = useCallback(() => {
    if (!isFollowing || isFollowLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    avatarScale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );

    onUnfollow(creatorId);
  }, [isFollowing, isFollowLoading, creatorId, onUnfollow, avatarScale]);

  // Profile tap
  const handleAvatarPress = useCallback(() => {
    avatarScale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onProfilePress?.(creatorId);
  }, [creatorId, onProfilePress, avatarScale]);

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        onPress={handleAvatarPress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        accessibilityRole="button"
        accessibilityLabel={`View @${creatorName || 'creator'}'s profile`}
        accessibilityHint={isFollowing ? 'Long press to unfollow' : undefined}
      >
        <Animated.View style={[styles.avatarOuter, avatarAnimatedStyle]}>
          {showFallback ? (
            <View style={styles.avatarFallback}>
              <Text style={styles.initialText}>{initial}</Text>
            </View>
          ) : (
            <Image
              source={{ uri: avatarUrl! }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
              onError={() => setImageError(true)}
            />
          )}
        </Animated.View>
      </Pressable>

      {showBadge && (
        <Animated.View
          style={[styles.badgeContainer, badgeAnimatedStyle]}
          entering={FadeIn.springify().damping(12)}
        >
          <Pressable
            onPress={handleFollowPress}
            disabled={isFollowLoading}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Follow ${creatorName || 'creator'}`}
          >
            <View style={[styles.badge, isFollowLoading && styles.badgeDisabled]}>
              <Plus size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER + BADGE_SIZE / 2 + 2,
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarOuter: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    borderWidth: AVATAR_BORDER,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: PRIMARY_FALLBACK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#FFFFFF',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: TIKTOK_RED,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeDisabled: {
    opacity: 0.5,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

function areEqual(
  prev: CreatorAvatarButtonProps,
  next: CreatorAvatarButtonProps,
): boolean {
  return (
    prev.creatorId === next.creatorId &&
    prev.avatarUrl === next.avatarUrl &&
    prev.creatorName === next.creatorName &&
    prev.isFollowing === next.isFollowing &&
    prev.isFollowLoading === next.isFollowLoading
  );
}

export const CreatorAvatarButton = memo(CreatorAvatarButtonComponent, areEqual);
export default CreatorAvatarButton;
