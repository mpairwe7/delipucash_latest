/**
 * WhyRecommendedBadge — Small pill showing why a video was recommended
 *
 * Maps recommendation/trending reasons to icons + human-readable labels.
 * Used in For You and Trending tabs on video feed items.
 *
 * @module components/video/WhyRecommendedBadge
 */

import React, { memo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Users,
  Heart,
  TrendingUp,
  Sparkles,
  Star,
  Zap,
  Share2,
  Play,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, withAlpha } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface WhyRecommendedBadgeProps {
  /** Recommendation or trending reason from the API */
  reason: string;
  /** Creator name (used for "Following" label) */
  creatorName?: string;
  testID?: string;
}

interface ReasonMapping {
  icon: LucideIcon;
  label: string;
}

// ============================================================================
// REASON MAP
// ============================================================================

const REASON_MAP: Record<string, ReasonMapping> = {
  // Recommendation reasons (For You tab)
  from_followed_creator: { icon: Users, label: 'Following' },
  because_you_liked_similar: { icon: Heart, label: 'You might like' },
  trending_in_your_area: { icon: TrendingUp, label: 'Trending near you' },
  new_creator_spotlight: { icon: Sparkles, label: 'New creator' },
  popular_this_week: { icon: Star, label: 'Popular' },

  // Trending reasons (Trending tab)
  rapid_engagement: { icon: Zap, label: 'Hot right now' },
  viral_shares: { icon: Share2, label: 'Going viral' },
  high_completion: { icon: Play, label: 'Must watch' },
  rising_creator: { icon: Sparkles, label: 'Rising creator' },
};

const FALLBACK: ReasonMapping = { icon: Star, label: 'Recommended' };

// ============================================================================
// COMPONENT
// ============================================================================

function WhyRecommendedBadgeComponent({
  reason,
  creatorName,
  testID,
}: WhyRecommendedBadgeProps): React.ReactElement | null {
  const { colors } = useTheme();

  const mapping = REASON_MAP[reason] ?? FALLBACK;
  const Icon = mapping.icon;

  // Override label for followed creators with their name
  const label =
    reason === 'from_followed_creator' && creatorName
      ? creatorName
      : mapping.label;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.badge,
        { backgroundColor: withAlpha(colors.background, 0.7) },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Recommended because: ${label}`}
      testID={testID}
    >
      <Icon
        size={11}
        color={colors.textSecondary}
        strokeWidth={2}
      />
      <Text
        style={[
          styles.label,
          { color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs + 1, // 3px
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs + 1, // 3px
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs, // 10px
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export const WhyRecommendedBadge = memo(WhyRecommendedBadgeComponent);
export default WhyRecommendedBadge;
