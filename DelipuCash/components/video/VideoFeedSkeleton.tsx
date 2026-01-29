/**
 * VideoFeedSkeleton Component
 * Loading skeleton for the vertical video feed
 * 
 * Features:
 * - Shimmer animation effect
 * - Matches VideoFeedItem layout
 * - Accessible loading state
 * 
 * @example
 * ```tsx
 * <VideoFeedSkeleton count={3} itemHeight={screenHeight} />
 * ```
 */

import React, { memo, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  SPACING,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SHIMMER_DURATION = 1500;

// ============================================================================
// TYPES
// ============================================================================

export interface VideoFeedSkeletonProps {
  /** Number of skeleton items to render */
  count?: number;
  /** Height of each skeleton item */
  itemHeight: number;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// SHIMMER COMPONENT
// ============================================================================

const ShimmerOverlay = memo(({ width, height }: { width: number; height: number }) => {
  const shimmerPosition = useSharedValue(-1);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION }),
      -1,
      false
    );
  }, [shimmerPosition]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmerPosition.value, [-1, 1], [-width, width]) },
    ],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
      <LinearGradient
        colors={[
          'transparent',
          withAlpha('#FFFFFF', 0.1),
          withAlpha('#FFFFFF', 0.15),
          withAlpha('#FFFFFF', 0.1),
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: width * 2, height }}
      />
    </Animated.View>
  );
});

ShimmerOverlay.displayName = 'ShimmerOverlay';

// ============================================================================
// SKELETON ITEM
// ============================================================================

const SkeletonItem = memo(({ itemHeight }: { itemHeight: number }) => {
  const bgColor = withAlpha('#333333', 0.6);

  return (
    <View 
      style={[styles.item, { height: itemHeight, backgroundColor: '#1A1A1A' }]}
      accessibilityRole="none"
    >
      {/* Main shimmer */}
      <ShimmerOverlay width={SCREEN_WIDTH} height={itemHeight} />

      {/* Gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.2, 0.7, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* Center play button skeleton */}
      <View style={styles.centerPlayButton}>
        <View style={[styles.playButtonBg, { backgroundColor: bgColor }]} />
      </View>

      {/* Mute button skeleton */}
      <View style={styles.muteButton}>
        <View style={[styles.iconButton, { backgroundColor: bgColor }]} />
      </View>

      {/* Side actions skeleton */}
      <View style={styles.sideActions}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.actionButton}>
            <View style={[styles.actionIcon, { backgroundColor: bgColor }]} />
            <View style={[styles.actionLabel, { backgroundColor: bgColor }]} />
          </View>
        ))}
      </View>

      {/* Bottom info skeleton */}
      <View style={styles.bottomInfo}>
        {/* Creator row */}
        <View style={styles.creatorRow}>
          <View style={[styles.avatar, { backgroundColor: bgColor }]} />
          <View style={[styles.creatorName, { backgroundColor: bgColor }]} />
          <View style={[styles.followButton, { backgroundColor: bgColor }]} />
        </View>

        {/* Title skeleton */}
        <View style={[styles.titleLine, { backgroundColor: bgColor }]} />
        <View style={[styles.titleLineShort, { backgroundColor: bgColor }]} />

        {/* Music row skeleton */}
        <View style={styles.musicRow}>
          <View style={[styles.musicIcon, { backgroundColor: bgColor }]} />
          <View style={[styles.musicText, { backgroundColor: bgColor }]} />
        </View>
      </View>

      {/* Progress bar skeleton */}
      <View style={styles.progressBar}>
        <View style={[styles.progressTrack, { backgroundColor: bgColor }]} />
      </View>
    </View>
  );
});

SkeletonItem.displayName = 'SkeletonItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function VideoFeedSkeletonComponent({
  count = 3,
  itemHeight,
  testID,
}: VideoFeedSkeletonProps): React.ReactElement {
  return (
    <View
      testID={testID}
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading videos"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} itemHeight={itemHeight} />
      ))}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  item: {
    width: SCREEN_WIDTH,
    position: 'relative',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -40,
    marginTop: -40,
  },
  playButtonBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  muteButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sideActions: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: 140,
    alignItems: 'center',
    gap: SPACING.lg,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  actionLabel: {
    width: 40,
    height: 10,
    borderRadius: RADIUS.sm,
  },
  bottomInfo: {
    position: 'absolute',
    left: SPACING.md,
    right: 80,
    bottom: SPACING.xl,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  creatorName: {
    width: 80,
    height: 16,
    borderRadius: RADIUS.sm,
  },
  followButton: {
    width: 60,
    height: 24,
    borderRadius: RADIUS.sm,
  },
  titleLine: {
    width: '90%',
    height: 16,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  titleLineShort: {
    width: '60%',
    height: 16,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  musicIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  musicText: {
    width: 120,
    height: 12,
    borderRadius: RADIUS.sm,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },
  progressTrack: {
    flex: 1,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const VideoFeedSkeleton = memo(VideoFeedSkeletonComponent);
export default VideoFeedSkeleton;
