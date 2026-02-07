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
  Plus,
} from 'lucide-react-native';
import {
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

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
    style={[styles.earnCta, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Start answering questions to earn rewards"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.earnCtaIcon,
        { backgroundColor: withAlpha(colors.primary, 0.15) },
      ]}
    >
      <Gift size={28} color={colors.primary} strokeWidth={1.5} />
    </View>
    <View style={styles.earnCtaContent}>
      <Text style={[styles.earnCtaTitle, { color: colors.text }]}>
        Answer Questions & Earn!
      </Text>
      <Text style={[styles.earnCtaSubtitle, { color: colors.textMuted }]}>
        Complete quizzes to earn points and cash rewards
      </Text>
      <View style={styles.earnCtaStats}>
        <View
          style={[
            styles.earnCtaStat,
            { backgroundColor: withAlpha(colors.warning, 0.15) },
          ]}
        >
          <Star size={12} color={colors.warning} strokeWidth={2} />
          <Text style={[styles.earnCtaStatText, { color: colors.warning }]}>
            {pointsPerQuestion} pts/question
          </Text>
        </View>
        {streakActive && (
          <View
            style={[
              styles.earnCtaStat,
              { backgroundColor: withAlpha(colors.error, 0.15) },
            ]}
          >
            <Flame size={12} color={colors.error} strokeWidth={2} />
            <Text style={[styles.earnCtaStatText, { color: colors.error }]}>
              Streak bonus
            </Text>
          </View>
        )}
      </View>
    </View>
    <View style={[styles.startButton, { backgroundColor: colors.primary }]}>
      <Play size={16} color={colors.primaryText} strokeWidth={2} />
      <Text style={[styles.startButtonText, { color: colors.primaryText }]}>
        Start
      </Text>
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
    style={[styles.instantRewardCard, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Browse instant reward questions for quick payouts"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.instantRewardIcon,
        { backgroundColor: withAlpha(colors.warning, 0.15) },
      ]}
    >
      <Sparkles size={24} color={colors.warning} strokeWidth={1.5} />
    </View>
    <View style={styles.instantRewardContent}>
      <Text style={[styles.instantRewardTitle, { color: colors.text }]}>
        Answer Instant Reward Questions!
      </Text>
      <Text
        style={[styles.instantRewardSubtitle, { color: colors.textMuted }]}
      >
        Earn instant payouts for quality answers
      </Text>
    </View>
    <Zap size={20} color={colors.warning} strokeWidth={2} />
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
    style={[styles.askQuestionsCta, { backgroundColor: colors.card }, style]}
    onPress={onPress}
    accessibilityLabel="Ask a question and get answers from the community"
    accessibilityRole="button"
  >
    <View
      style={[
        styles.askQuestionsIcon,
        { backgroundColor: withAlpha(colors.info, 0.15) },
      ]}
    >
      <HelpCircle size={24} color={colors.info} strokeWidth={1.5} />
    </View>
    <View style={styles.askQuestionsContent}>
      <Text style={[styles.askQuestionsTitle, { color: colors.text }]}>
        Ask the Community
      </Text>
      <Text
        style={[styles.askQuestionsSubtitle, { color: colors.textMuted }]}
      >
        Get answers from experts and community members
      </Text>
      <View style={styles.askQuestionsStats}>
        <View
          style={[
            styles.askQuestionsStat,
            { backgroundColor: withAlpha(colors.info, 0.15) },
          ]}
        >
          <MessageCircle size={12} color={colors.info} strokeWidth={2} />
          <Text style={[styles.askQuestionsStatText, { color: colors.info }]}>
            Quick responses
          </Text>
        </View>
        <View
          style={[
            styles.askQuestionsStat,
            { backgroundColor: withAlpha(colors.success, 0.15) },
          ]}
        >
          <TrendingUp size={12} color={colors.success} strokeWidth={2} />
          <Text
            style={[styles.askQuestionsStatText, { color: colors.success }]}
          >
            Build reputation
          </Text>
        </View>
      </View>
    </View>
    <Plus size={20} color={colors.info} strokeWidth={2} />
  </Pressable>
);

export const AskCommunityCTA = memo(AskCommunityCTAComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Earn CTA
  earnCta: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  earnCtaIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnCtaContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  earnCtaTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  earnCtaSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  earnCtaStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  earnCtaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  earnCtaStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  startButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Instant Reward CTA
  instantRewardCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  instantRewardIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantRewardContent: {
    flex: 1,
    gap: 2,
  },
  instantRewardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  instantRewardSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Ask Community CTA
  askQuestionsCta: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  askQuestionsIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askQuestionsContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  askQuestionsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  askQuestionsSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  askQuestionsStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  askQuestionsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  askQuestionsStatText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});
