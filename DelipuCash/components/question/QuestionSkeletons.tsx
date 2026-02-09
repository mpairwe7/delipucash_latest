/**
 * Question Screen Skeleton Loaders
 * Shimmer-effect loading states for question-related screens
 *
 * Features:
 * - Reanimated shimmer animation (60fps, UI thread)
 * - Reduced motion support (static placeholder)
 * - Matches actual component layouts for zero layout shift
 * - WCAG 2.2 AA: accessibilityRole="progressbar", accessibilityLabel
 */

import React, { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  RADIUS,
  SPACING,
  useTheme,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// SHIMMER BASE
// ============================================================================

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

const Shimmer = memo(function Shimmer({
  width,
  height,
  borderRadius = RADIUS.md,
  style,
}: ShimmerProps) {
  const { colors } = useTheme();
  const shimmerPosition = useSharedValue(-1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [reduceMotion, shimmerPosition]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerPosition.value,
          [-1, 1],
          [-SCREEN_WIDTH, SCREEN_WIDTH],
        ),
      },
    ],
  }));

  const baseColor = withAlpha(colors.textMuted, 0.1);
  const shimmerColor = withAlpha(colors.textMuted, 0.2);

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: baseColor, overflow: 'hidden' },
        style,
      ]}
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
    >
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <LinearGradient
            colors={['transparent', shimmerColor, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
});

// ============================================================================
// ANSWER QUESTION SCREEN SKELETON
// ============================================================================

function AnswerQuestionSkeletonComponent(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Loading question details"
    >
      {/* Header */}
      <View style={[styles.headerSkeleton, { backgroundColor: colors.card }]}>
        <Shimmer width={44} height={44} borderRadius={RADIUS.full} />
        <View style={styles.headerTextSkeleton}>
          <Shimmer width={140} height={20} />
          <Shimmer width={90} height={14} style={{ marginTop: SPACING.xs }} />
        </View>
      </View>

      {/* Question card */}
      <View style={[styles.cardSkeleton, { backgroundColor: colors.card }]}>
        <View style={styles.badgeRow}>
          <Shimmer width={80} height={26} borderRadius={RADIUS.md} />
          <Shimmer width={70} height={26} borderRadius={RADIUS.md} />
        </View>
        <Shimmer width="100%" height={22} style={{ marginTop: SPACING.md }} />
        <Shimmer width="80%" height={22} style={{ marginTop: SPACING.sm }} />
        <Shimmer width="60%" height={22} style={{ marginTop: SPACING.sm }} />
        <View style={[styles.metaRow, { marginTop: SPACING.base }]}>
          <Shimmer width={32} height={32} borderRadius={RADIUS.full} />
          <Shimmer width={100} height={14} />
          <Shimmer width={80} height={14} />
        </View>
        <View style={[styles.statsRowSkeleton, { borderTopColor: colors.border }]}>
          <Shimmer width={100} height={16} />
        </View>
      </View>

      {/* Answer input card */}
      <View style={[styles.cardSkeleton, { backgroundColor: colors.card }]}>
        <Shimmer width={100} height={18} />
        <Shimmer
          width="100%"
          height={120}
          borderRadius={RADIUS.base}
          style={{ marginTop: SPACING.md }}
        />
        <View style={[styles.metaRow, { marginTop: SPACING.sm }]}>
          <Shimmer width={50} height={12} />
        </View>
      </View>

      {/* Answer cards */}
      <View style={styles.answersSkeleton}>
        <Shimmer width={160} height={20} style={{ marginBottom: SPACING.base }} />
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[styles.answerCardSkeleton, { backgroundColor: colors.card }]}
          >
            <View style={styles.metaRow}>
              <Shimmer width={36} height={36} borderRadius={RADIUS.full} />
              <View>
                <Shimmer width={100} height={14} />
                <Shimmer width={60} height={12} style={{ marginTop: SPACING.xxs }} />
              </View>
            </View>
            <Shimmer width="100%" height={16} style={{ marginTop: SPACING.md }} />
            <Shimmer width="90%" height={16} style={{ marginTop: SPACING.xs }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export const AnswerQuestionSkeleton = memo(AnswerQuestionSkeletonComponent);

// ============================================================================
// QUESTION DETAIL SCREEN SKELETON (responses list)
// ============================================================================

function QuestionDetailSkeletonComponent(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Loading question discussion"
    >
      {/* Hero card */}
      <View style={[styles.heroSkeleton, { backgroundColor: colors.card }]}>
        <View style={styles.badgeRow}>
          <Shimmer width={80} height={24} borderRadius={RADIUS.full} />
          <Shimmer width={60} height={24} borderRadius={RADIUS.full} />
        </View>
        <Shimmer width="100%" height={20} style={{ marginTop: SPACING.md }} />
        <Shimmer width="75%" height={20} style={{ marginTop: SPACING.sm }} />
        <View style={[styles.metaRow, { marginTop: SPACING.base }]}>
          <Shimmer width={40} height={40} borderRadius={RADIUS.full} />
          <View>
            <Shimmer width={120} height={14} />
            <Shimmer width={80} height={12} style={{ marginTop: SPACING.xxs }} />
          </View>
        </View>
      </View>

      {/* Response skeleton cards */}
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.responseCardSkeleton, { backgroundColor: colors.card }]}
        >
          <View style={styles.metaRow}>
            <Shimmer width={40} height={40} borderRadius={RADIUS.full} />
            <View style={{ flex: 1 }}>
              <Shimmer width={110} height={14} />
              <Shimmer width={70} height={12} style={{ marginTop: SPACING.xxs }} />
            </View>
            <Shimmer width={20} height={20} />
          </View>
          <Shimmer width="100%" height={16} style={{ marginTop: SPACING.md }} />
          <Shimmer width="95%" height={16} style={{ marginTop: SPACING.xs }} />
          <Shimmer width="60%" height={16} style={{ marginTop: SPACING.xs }} />
          <View style={[styles.metaRow, { marginTop: SPACING.md }]}>
            <Shimmer width={60} height={24} borderRadius={RADIUS.sm} />
            <Shimmer width={60} height={24} borderRadius={RADIUS.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

export const QuestionDetailSkeleton = memo(QuestionDetailSkeletonComponent);

// ============================================================================
// REWARD QUESTION SKELETON (quiz-style with options)
// ============================================================================

function RewardQuestionSkeletonComponent(): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      accessibilityLabel="Loading reward question"
    >
      {/* Header */}
      <View style={[styles.headerSkeleton, { backgroundColor: colors.card }]}>
        <Shimmer width={44} height={44} borderRadius={RADIUS.full} />
        <View style={styles.headerTextSkeleton}>
          <Shimmer width={160} height={20} />
          <Shimmer width={80} height={14} style={{ marginTop: SPACING.xs }} />
        </View>
      </View>

      {/* Timer + spots */}
      <View style={styles.timerRow}>
        <Shimmer width={120} height={40} borderRadius={RADIUS.md} />
        <Shimmer width={100} height={40} borderRadius={RADIUS.md} />
      </View>

      {/* Question text */}
      <View style={[styles.cardSkeleton, { backgroundColor: colors.card }]}>
        <Shimmer width="100%" height={22} />
        <Shimmer width="85%" height={22} style={{ marginTop: SPACING.sm }} />
        <Shimmer width="50%" height={22} style={{ marginTop: SPACING.sm }} />
      </View>

      {/* Option items */}
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.optionSkeleton, { backgroundColor: colors.card }]}
        >
          <Shimmer width={32} height={32} borderRadius={RADIUS.full} />
          <Shimmer width="70%" height={18} />
        </View>
      ))}

      {/* Submit button */}
      <Shimmer
        width="100%"
        height={52}
        borderRadius={RADIUS.base}
        style={{ marginTop: SPACING.xl, marginHorizontal: SPACING.base }}
      />
    </View>
  );
}

export const RewardQuestionSkeleton = memo(RewardQuestionSkeletonComponent);

// ============================================================================
// INSTANT REWARD QUESTIONS LIST SKELETON
// ============================================================================

function InstantRewardListSkeletonComponent({
  count = 3,
}: {
  count?: number;
}): React.ReactElement {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={`Loading ${count} reward questions`}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.rewardListCard, { backgroundColor: colors.card }]}
        >
          <View style={styles.metaRow}>
            <Shimmer width={48} height={48} borderRadius={RADIUS.md} />
            <View style={{ flex: 1 }}>
              <Shimmer width="85%" height={16} />
              <Shimmer width="60%" height={14} style={{ marginTop: SPACING.xs }} />
            </View>
            <Shimmer width={70} height={28} borderRadius={RADIUS.md} />
          </View>
        </View>
      ))}
    </View>
  );
}

export const InstantRewardListSkeleton = memo(InstantRewardListSkeletonComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.base,
  },
  headerSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.base,
    marginBottom: SPACING.base,
    borderRadius: RADIUS.lg,
  },
  headerTextSkeleton: {
    flex: 1,
  },
  cardSkeleton: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.base,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statsRowSkeleton: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  answersSkeleton: {
    marginTop: SPACING.sm,
  },
  answerCardSkeleton: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  heroSkeleton: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  responseCardSkeleton: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.base,
  },
  optionSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.base,
    borderRadius: RADIUS.base,
    marginBottom: SPACING.sm,
  },
  rewardListCard: {
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
});
