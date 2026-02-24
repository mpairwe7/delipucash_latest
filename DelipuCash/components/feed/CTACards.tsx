/**
 * CTA Card Components — Extracted from FeedHeader for Performance
 *
 * These are static-ish UI cards that rarely change. By extracting them
 * as separate memo'd components, they avoid re-rendering when unrelated
 * FeedHeader props change (search state, tab selection, ad data, etc.).
 *
 * Each card receives only its own minimal props, keeping React.memo
 * comparisons cheap and effective.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {
  Gift,
  Play,
  Star,
  Flame,
  Sparkles,
  Zap,
  HelpCircle,
  MessageCircle,
  TrendingUp,
  ChevronRight,
} from 'lucide-react-native';
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// Shared CTA constants — ensures visual consistency across all cards
// ============================================================================

const CTA_ICON_CONTAINER = 48;
const CTA_ICON_SIZE = 24;
const CTA_ACTION_CONTAINER = 32;

// ============================================================================
// Answer & Earn CTA
// ============================================================================

interface AnswerEarnCTAProps {
  colors: {
    card: string;
    primary: string;
    primaryText: string;
    text: string;
    textMuted: string;
    warning: string;
    error: string;
  };
  pointsPerQuestion: number;
  streakActive: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const AnswerEarnCTAComponent: React.FC<AnswerEarnCTAProps> = ({
  colors,
  pointsPerQuestion,
  streakActive,
  onPress,
  style,
}) => (
  <Pressable
    style={[styles.ctaCard, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Start answering questions to earn rewards"
    accessibilityHint="Navigates to the answer questions screen"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.ctaIconContainer,
        { backgroundColor: withAlpha(colors.primary, 0.15) },
      ]}
    >
      <Gift size={CTA_ICON_SIZE} color={colors.primary} strokeWidth={1.5} />
    </View>
    <View style={styles.ctaContent}>
      <Text style={[styles.ctaTitle, { color: colors.text }]}>
        Answer Questions & Earn!
      </Text>
      <Text style={[styles.ctaSubtitle, { color: colors.textMuted }]}>
        Complete quizzes to earn points and cash rewards
      </Text>
      <View style={styles.ctaStats}>
        <View
          style={[
            styles.ctaStat,
            { backgroundColor: withAlpha(colors.warning, 0.15) },
          ]}
        >
          <Star size={12} color={colors.warning} strokeWidth={2} />
          <Text style={[styles.ctaStatText, { color: colors.warning }]}>
            {pointsPerQuestion} pts/question
          </Text>
        </View>
        {streakActive && (
          <View
            style={[
              styles.ctaStat,
              { backgroundColor: withAlpha(colors.error, 0.15) },
            ]}
          >
            <Flame size={12} color={colors.error} strokeWidth={2} />
            <Text style={[styles.ctaStatText, { color: colors.error }]}>
              Streak bonus
            </Text>
          </View>
        )}
      </View>
    </View>
    <View
      style={[
        styles.ctaAction,
        { backgroundColor: withAlpha(colors.primary, 0.12) },
      ]}
    >
      <Play size={16} color={colors.primary} strokeWidth={2.5} />
    </View>
  </Pressable>
);

export const AnswerEarnCTA = memo(AnswerEarnCTAComponent);

// ============================================================================
// Instant Reward Questions CTA
// ============================================================================

interface InstantRewardCTAProps {
  colors: {
    card: string;
    text: string;
    textMuted: string;
    warning: string;
  };
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const InstantRewardCTAComponent: React.FC<InstantRewardCTAProps> = ({
  colors,
  onPress,
  style,
}) => (
  <Pressable
    style={[styles.ctaCard, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Browse instant reward questions for quick payouts"
    accessibilityHint="Navigates to the instant reward questions screen"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.ctaIconContainer,
        { backgroundColor: withAlpha(colors.warning, 0.15) },
      ]}
    >
      <Sparkles size={CTA_ICON_SIZE} color={colors.warning} strokeWidth={1.5} />
    </View>
    <View style={styles.ctaContent}>
      <Text style={[styles.ctaTitle, { color: colors.text }]}>
        Answer Instant Reward Questions!
      </Text>
      <Text style={[styles.ctaSubtitle, { color: colors.textMuted }]}>
        Earn instant payouts for quality answers
      </Text>
    </View>
    <View
      style={[
        styles.ctaAction,
        { backgroundColor: withAlpha(colors.warning, 0.12) },
      ]}
    >
      <Zap size={16} color={colors.warning} strokeWidth={2.5} />
    </View>
  </Pressable>
);

export const InstantRewardCTA = memo(InstantRewardCTAComponent);

// ============================================================================
// Ask Community CTA
// ============================================================================

interface AskCommunityCTAProps {
  colors: {
    card: string;
    text: string;
    textMuted: string;
    info: string;
    success: string;
  };
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const AskCommunityCTAComponent: React.FC<AskCommunityCTAProps> = ({
  colors,
  onPress,
  style,
}) => (
  <Pressable
    style={[styles.ctaCard, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Ask a question and get answers from the community"
    accessibilityHint="Opens the question creation wizard"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.ctaIconContainer,
        { backgroundColor: withAlpha(colors.info, 0.15) },
      ]}
    >
      <HelpCircle size={CTA_ICON_SIZE} color={colors.info} strokeWidth={1.5} />
    </View>
    <View style={styles.ctaContent}>
      <Text style={[styles.ctaTitle, { color: colors.text }]}>
        Ask the Community
      </Text>
      <Text style={[styles.ctaSubtitle, { color: colors.textMuted }]}>
        Get answers from experts and community members
      </Text>
      <View style={styles.ctaStats}>
        <View
          style={[
            styles.ctaStat,
            { backgroundColor: withAlpha(colors.info, 0.15) },
          ]}
        >
          <MessageCircle size={12} color={colors.info} strokeWidth={2} />
          <Text style={[styles.ctaStatText, { color: colors.info }]}>
            Quick responses
          </Text>
        </View>
        <View
          style={[
            styles.ctaStat,
            { backgroundColor: withAlpha(colors.success, 0.15) },
          ]}
        >
          <TrendingUp size={12} color={colors.success} strokeWidth={2} />
          <Text
            style={[styles.ctaStatText, { color: colors.success }]}
          >
            Build reputation
          </Text>
        </View>
      </View>
    </View>
    <View
      style={[
        styles.ctaAction,
        { backgroundColor: withAlpha(colors.info, 0.12) },
      ]}
    >
      <ChevronRight size={16} color={colors.info} strokeWidth={2.5} />
    </View>
  </Pressable>
);

export const AskCommunityCTA = memo(AskCommunityCTAComponent);

// ============================================================================
// STYLES — Unified CTA card design system
// ============================================================================

const styles = StyleSheet.create({
  // Shared CTA card base
  ctaCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  ctaIconContainer: {
    width: CTA_ICON_CONTAINER,
    height: CTA_ICON_CONTAINER,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  ctaTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  ctaSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  ctaStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  ctaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  ctaStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  ctaAction: {
    width: CTA_ACTION_CONTAINER,
    height: CTA_ACTION_CONTAINER,
    borderRadius: CTA_ACTION_CONTAINER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
