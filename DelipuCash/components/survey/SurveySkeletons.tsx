/**
 * Survey Skeleton Components
 * Loading placeholders for survey screens following 2025/2026 best practices
 * 
 * Features:
 * - Animated shimmer effect (respects reduced motion)
 * - Multiple skeleton variants for different card types
 * - Accessible (hidden from screen readers, proper roles)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import {
  SPACING,
  RADIUS,
  useTheme,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// BASE SKELETON COMPONENT
// ============================================================================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = RADIUS.sm,
  style,
}) => {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = React.useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim, reducedMotion]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        styles.skeletonBase,
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: withAlpha(colors.text, 0.08),
          overflow: 'hidden',
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {!reducedMotion && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              backgroundColor: withAlpha(colors.text, 0.04),
              transform: [{ translateX }],
            },
          ]}
        />
      )}
    </View>
  );
};

// ============================================================================
// SURVEY CARD SKELETON
// ============================================================================

interface SurveyCardSkeletonProps {
  variant?: 'detailed' | 'compact' | 'grid';
}

export const SurveyCardSkeleton: React.FC<SurveyCardSkeletonProps> = ({
  variant = 'detailed',
}) => {
  const { colors } = useTheme();

  if (variant === 'compact') {
    return (
      <View
        style={[
          styles.cardCompact,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessibilityLabel="Loading survey list"
        accessibilityRole="none"
      >
        <View style={styles.compactContent}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: SPACING.xs }} />
        </View>
        <Skeleton width={80} height={28} borderRadius={RADIUS.md} />
      </View>
    );
  }

  if (variant === 'grid') {
    return (
      <View
        style={[
          styles.cardGrid,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessibilityLabel="Loading survey list"
        accessibilityRole="none"
      >
        <Skeleton width="100%" height={80} borderRadius={RADIUS.md} />
        <View style={styles.gridContent}>
          <Skeleton width="80%" height={14} style={{ marginTop: SPACING.sm }} />
          <Skeleton width="50%" height={12} style={{ marginTop: SPACING.xs }} />
          <View style={styles.gridStats}>
            <Skeleton width={40} height={20} borderRadius={RADIUS.sm} />
            <Skeleton width={40} height={20} borderRadius={RADIUS.sm} />
          </View>
        </View>
      </View>
    );
  }

  // Detailed (default)
  return (
    <View
      style={[
        styles.cardDetailed,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityLabel="Loading survey list"
      accessibilityRole="none"
    >
      <View style={styles.cardHeader}>
        <Skeleton width={48} height={48} borderRadius={RADIUS.md} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="75%" height={16} />
          <Skeleton width="45%" height={12} style={{ marginTop: SPACING.xs }} />
        </View>
        <Skeleton width={60} height={24} borderRadius={RADIUS.full} />
      </View>
      <Skeleton width="100%" height={36} style={{ marginTop: SPACING.md }} />
      <View style={styles.cardFooter}>
        <View style={styles.statsRow}>
          <Skeleton width={50} height={14} />
          <Skeleton width={50} height={14} />
          <Skeleton width={50} height={14} />
        </View>
        <Skeleton width={90} height={32} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
};

// ============================================================================
// ANALYTICS SKELETON
// ============================================================================

export const AnalyticsMetricSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityLabel="Loading metric"
    >
      <Skeleton width={32} height={32} borderRadius={RADIUS.full} />
      <Skeleton width="60%" height={24} style={{ marginTop: SPACING.sm }} />
      <Skeleton width="40%" height={12} style={{ marginTop: SPACING.xs }} />
    </View>
  );
};

export const AnalyticsChartSkeleton: React.FC<{ height?: number }> = ({
  height = 200,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.chartCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityLabel="Loading chart"
    >
      <View style={styles.chartHeader}>
        <Skeleton width="40%" height={16} />
        <Skeleton width={60} height={24} borderRadius={RADIUS.sm} />
      </View>
      <Skeleton width="100%" height={height} style={{ marginTop: SPACING.md }} />
    </View>
  );
};

export const AnalyticsDashboardSkeleton: React.FC = () => {
  return (
    <View style={styles.dashboardContainer}>
      {/* Key Metrics Row */}
      <View style={styles.metricsRow}>
        <AnalyticsMetricSkeleton />
        <AnalyticsMetricSkeleton />
      </View>
      <View style={styles.metricsRow}>
        <AnalyticsMetricSkeleton />
        <AnalyticsMetricSkeleton />
      </View>
      
      {/* Charts */}
      <AnalyticsChartSkeleton height={180} />
      <AnalyticsChartSkeleton height={160} />
    </View>
  );
};

// ============================================================================
// TEMPLATE CARD SKELETON
// ============================================================================

export const TemplateCardSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.templateCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      accessibilityLabel="Loading template"
    >
      <Skeleton width={40} height={40} borderRadius={RADIUS.md} />
      <View style={styles.templateContent}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={12} style={{ marginTop: SPACING.xs }} />
        <View style={styles.templateMeta}>
          <Skeleton width={50} height={16} borderRadius={RADIUS.full} />
          <Skeleton width={50} height={16} borderRadius={RADIUS.full} />
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// LIST SKELETON
// ============================================================================

interface ListSkeletonProps {
  count?: number;
  variant?: 'detailed' | 'compact' | 'grid';
}

export const SurveyListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 3,
  variant = 'detailed',
}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SurveyCardSkeleton key={`skeleton-${index}`} variant={variant} />
      ))}
    </View>
  );
};

export const TemplateListSkeleton: React.FC<{ count?: number }> = ({
  count = 4,
}) => {
  return (
    <View style={styles.templateListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <TemplateCardSkeleton key={`template-skeleton-${index}`} />
      ))}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  skeletonBase: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    transform: [{ skewX: '-20deg' }],
  },

  // Card skeletons
  cardDetailed: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  compactContent: {
    flex: 1,
  },

  cardGrid: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  gridContent: {
    flex: 1,
  },
  gridStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  // Analytics skeletons
  metricCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  chartCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboardContainer: {
    padding: SPACING.md,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },

  // Template skeletons
  templateCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  templateContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  // List containers
  listContainer: {
    paddingVertical: SPACING.sm,
  },
  templateListContainer: {
    paddingVertical: SPACING.sm,
  },
});
