/**
 * SkeletonLoader Components
 * Provides smooth skeleton loading states for the home dashboard
 * Following 2025-2026 design standards with shimmer animations
 * 
 * WCAG 2.2 AA: Reduced motion support, proper contrast
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

interface SkeletonBaseProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Base skeleton component with shimmer animation
 */
export function SkeletonBase({
  width = '100%',
  height = 20,
  borderRadius = RADIUS.md,
  style,
}: SkeletonBaseProps): React.ReactElement {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmer.value,
          [0, 1],
          [-SCREEN_WIDTH, SCREEN_WIDTH]
        ),
      },
    ],
  }));

  return (
    <View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius,
          backgroundColor: withAlpha(colors.border, 0.5),
        },
        style,
      ]}
      accessible
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
    >
      <Animated.View style={[styles.shimmerOverlay, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            withAlpha(colors.background, 0.3),
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Hero card skeleton for daily reward section
 */
export function HeroCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.heroSkeleton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
      accessible
      accessibilityLabel="Loading daily reward"
    >
      <View style={styles.heroSkeletonContent}>
        <SkeletonBase width={64} height={64} borderRadius={RADIUS.xl} />
        <View style={styles.heroSkeletonText}>
          <SkeletonBase width="60%" height={24} />
          <SkeletonBase width="40%" height={16} style={{ marginTop: SPACING.sm }} />
        </View>
      </View>
      <SkeletonBase width={120} height={48} borderRadius={RADIUS.full} />
    </View>
  );
}

/**
 * Quick action button skeleton
 */
export function QuickActionSkeleton(): React.ReactElement {
  return (
    <View style={styles.quickActionSkeleton} accessibilityLabel="Loading action">
      <SkeletonBase width={56} height={56} borderRadius={RADIUS.lg} />
      <SkeletonBase width={48} height={12} style={{ marginTop: SPACING.xs }} />
    </View>
  );
}

/**
 * Quick actions row skeleton
 */
export function QuickActionsRowSkeleton(): React.ReactElement {
  return (
    <View style={styles.quickActionsRow} accessible accessibilityLabel="Loading quick actions">
      <QuickActionSkeleton />
      <QuickActionSkeleton />
      <QuickActionSkeleton />
      <QuickActionSkeleton />
    </View>
  );
}

/**
 * Video card skeleton
 */
export function VideoCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.videoCardSkeleton, { backgroundColor: colors.card }]} accessibilityLabel="Loading video">
      <SkeletonBase height={120} borderRadius={RADIUS.lg} />
      <View style={styles.videoCardSkeletonContent}>
        <SkeletonBase width="80%" height={16} />
        <SkeletonBase width="50%" height={12} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
  );
}

/**
 * Horizontal video list skeleton
 */
export function VideoListSkeleton(): React.ReactElement {
  return (
    <View style={styles.videoListSkeleton} accessible accessibilityLabel="Loading videos">
      <VideoCardSkeleton />
      <VideoCardSkeleton />
      <VideoCardSkeleton />
    </View>
  );
}

/**
 * Survey card skeleton
 */
export function SurveyCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.surveyCardSkeleton, { backgroundColor: colors.card }]}>
      <View style={styles.surveyCardSkeletonHeader}>
        <SkeletonBase width={40} height={40} borderRadius={RADIUS.md} />
        <View style={styles.surveyCardSkeletonTitle}>
          <SkeletonBase width="70%" height={16} />
          <SkeletonBase width="40%" height={12} style={{ marginTop: SPACING.xs }} />
        </View>
      </View>
      <SkeletonBase width="100%" height={36} borderRadius={RADIUS.md} />
    </View>
  );
}

/**
 * Question card skeleton
 */
export function QuestionCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.questionCardSkeleton, { backgroundColor: colors.card }]}>
      <View style={styles.questionCardSkeletonRow}>
        <SkeletonBase width={32} height={32} borderRadius={RADIUS.full} />
        <SkeletonBase width="60%" height={16} style={{ marginLeft: SPACING.sm }} />
      </View>
      <SkeletonBase width="90%" height={14} style={{ marginTop: SPACING.sm }} />
      <View style={styles.questionCardSkeletonTags}>
        <SkeletonBase width={60} height={24} borderRadius={RADIUS.full} />
        <SkeletonBase width={80} height={24} borderRadius={RADIUS.full} />
      </View>
    </View>
  );
}

/**
 * Stat card skeleton
 */
export function StatCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.statCardSkeleton, { backgroundColor: colors.card }]}>
      <SkeletonBase width={24} height={24} borderRadius={RADIUS.sm} />
      <SkeletonBase width="60%" height={24} style={{ marginTop: SPACING.sm }} />
      <SkeletonBase width="40%" height={12} style={{ marginTop: SPACING.xs }} />
    </View>
  );
}

/**
 * Wallet card skeleton
 */
export function WalletCardSkeleton(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.walletSkeleton, { backgroundColor: withAlpha(colors.primary, 0.2) }]}
      accessible
      accessibilityLabel="Loading wallet balance"
    >
      <View style={styles.walletSkeletonHeader}>
        <SkeletonBase width={24} height={24} borderRadius={RADIUS.sm} />
        <SkeletonBase width={100} height={16} style={{ marginLeft: SPACING.sm }} />
      </View>
      <SkeletonBase width="50%" height={40} style={{ marginTop: SPACING.md }} />
      <View style={styles.walletSkeletonActions}>
        <SkeletonBase width={100} height={36} borderRadius={RADIUS.md} />
        <SkeletonBase width={80} height={36} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}

/**
 * Full dashboard skeleton for initial load
 */
export function DashboardSkeleton(): React.ReactElement {
  return (
    <View style={styles.dashboardSkeleton} accessible accessibilityLabel="Loading dashboard">
      {/* Header skeleton */}
      <View style={styles.headerSkeleton}>
        <View>
          <SkeletonBase width={100} height={14} />
          <SkeletonBase width={150} height={28} style={{ marginTop: SPACING.xs }} />
        </View>
        <SkeletonBase width={44} height={44} borderRadius={RADIUS.full} />
      </View>

      {/* Hero card */}
      <HeroCardSkeleton />

      {/* Quick actions */}
      <QuickActionsRowSkeleton />

      {/* Stats row */}
      <View style={styles.statsRowSkeleton}>
        <StatCardSkeleton />
        <StatCardSkeleton />
      </View>

      {/* Section header */}
      <View style={styles.sectionHeaderSkeleton}>
        <SkeletonBase width={140} height={20} />
        <SkeletonBase width={60} height={16} />
      </View>

      {/* Video list */}
      <VideoListSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    overflow: 'hidden',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerGradient: {
    flex: 1,
    width: SCREEN_WIDTH,
  },

  // Hero card skeleton
  heroSkeleton: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  heroSkeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  heroSkeletonText: {
    flex: 1,
    marginLeft: SPACING.base,
  },

  // Quick actions
  quickActionSkeleton: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },

  // Video card
  videoCardSkeleton: {
    width: 160,
    borderRadius: RADIUS.lg,
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  videoCardSkeletonContent: {
    padding: SPACING.sm,
  },
  videoListSkeleton: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
  },

  // Survey card
  surveyCardSkeleton: {
    width: 200,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginRight: SPACING.md,
  },
  surveyCardSkeletonHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  surveyCardSkeletonTitle: {
    flex: 1,
    marginLeft: SPACING.sm,
  },

  // Question card
  questionCardSkeleton: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
  },
  questionCardSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionCardSkeletonTags: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  // Stat card
  statCardSkeleton: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginHorizontal: SPACING.xs,
  },

  // Wallet
  walletSkeleton: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  walletSkeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletSkeletonActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.base,
  },

  // Dashboard
  dashboardSkeleton: {
    padding: SPACING.lg,
  },
  headerSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statsRowSkeleton: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  sectionHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
});

export default {
  SkeletonBase,
  HeroCardSkeleton,
  QuickActionSkeleton,
  QuickActionsRowSkeleton,
  VideoCardSkeleton,
  VideoListSkeleton,
  SurveyCardSkeleton,
  QuestionCardSkeleton,
  StatCardSkeleton,
  WalletCardSkeleton,
  DashboardSkeleton,
};
