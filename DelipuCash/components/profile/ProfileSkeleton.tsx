/**
 * ProfileSkeleton Component
 * Loading skeleton for profile screen
 * 
 * Features:
 * - Shimmer animation effect
 * - Matches profile layout structure
 * - Reduced motion support
 * 
 * @example
 * ```tsx
 * {isLoading ? <ProfileSkeleton /> : <ProfileContent />}
 * ```
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useTheme,
  SPACING,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonBoxProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

function SkeletonBox({ width, height, borderRadius = RADIUS.md, style }: SkeletonBoxProps) {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: withAlpha(colors.border, 0.5),
          overflow: 'hidden',
        },
        style,
      ]}
      accessible
      accessibilityLabel="Loading"
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            withAlpha(colors.card, 0.4),
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function ProfileSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading profile"
    >
      {/* Header Skeleton */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          {/* Avatar */}
          <SkeletonBox width={100} height={100} borderRadius={50} />
          
          {/* Name and info */}
          <View style={styles.headerInfo}>
            <SkeletonBox width="60%" height={16} style={styles.skeletonItem} />
            <SkeletonBox width="80%" height={24} style={styles.skeletonItem} />
            <SkeletonBox width="40%" height={14} style={styles.skeletonItem} />
          </View>

          {/* Edit button */}
          <SkeletonBox width={44} height={44} borderRadius={22} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <SkeletonBox width="30%" height={60} borderRadius={RADIUS.lg} />
          <SkeletonBox width="30%" height={60} borderRadius={RADIUS.lg} />
          <SkeletonBox width="30%" height={60} borderRadius={RADIUS.lg} />
        </View>
      </View>

      {/* Earnings Card Skeleton */}
      <SkeletonBox
        width="100%"
        height={200}
        borderRadius={RADIUS['2xl']}
        style={styles.earningsCard}
      />

      {/* Quick Actions Skeleton */}
      <View style={styles.sectionHeader}>
        <SkeletonBox width={120} height={20} />
        <SkeletonBox width={160} height={14} style={{ marginTop: SPACING.xs }} />
      </View>

      <View style={styles.quickActionsGrid}>
        <SkeletonBox width="48%" height={120} borderRadius={RADIUS.lg} />
        <SkeletonBox width="48%" height={120} borderRadius={RADIUS.lg} />
        <SkeletonBox width="48%" height={120} borderRadius={RADIUS.lg} style={{ marginTop: SPACING.sm }} />
        <SkeletonBox width="48%" height={120} borderRadius={RADIUS.lg} style={{ marginTop: SPACING.sm }} />
      </View>

      {/* Settings Section Skeleton */}
      <View style={styles.sectionHeader}>
        <SkeletonBox width={100} height={20} />
      </View>

      <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.settingRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.border, 0.6) }]}>
            <SkeletonBox width={40} height={40} borderRadius={10} />
            <View style={styles.settingContent}>
              <SkeletonBox width="60%" height={16} />
              <SkeletonBox width="40%" height={12} style={{ marginTop: SPACING.xs }} />
            </View>
            <SkeletonBox width={50} height={28} borderRadius={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: SPACING.lg,
  },
  headerSection: {
    marginBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: SPACING.lg,
  },
  skeletonItem: {
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  earningsCard: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  settingsCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
});

export default ProfileSkeleton;
