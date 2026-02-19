/**
 * CreationProgressBadges — Gamification badges display for survey creation
 *
 * Reads earnedBadges from SurveyBuilderStore and renders a horizontal
 * scrollable row of animated badge circles. Earned badges show a colored
 * icon with label; unearned badges appear dim with a lock indicator.
 * Purely cosmetic/motivational — no side effects.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView } from 'react-native';
import {
  Award,
  Sparkles,
  GitBranch,
  FileUp,
  Layers,
  CheckCircle2,
  Lock,
} from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, useTheme, withAlpha } from '@/utils/theme';
import {
  useSurveyBuilderStore,
  selectEarnedBadges,
} from '@/store/SurveyBuilderStore';

// ============================================================================
// BADGE DEFINITIONS
// ============================================================================

const BADGE_DEFS = [
  { id: 'first_question', label: 'First Question', icon: CheckCircle2, color: '#10B981' },
  { id: 'five_questions', label: 'Survey Builder', icon: Layers, color: '#6366F1' },
  { id: 'ten_questions', label: 'Survey Architect', icon: Award, color: '#F59E0B' },
  { id: 'has_logic', label: 'Logic Master', icon: GitBranch, color: '#8B5CF6' },
  { id: 'has_file_upload', label: 'File Collector', icon: FileUp, color: '#EC4899' },
  { id: 'variety', label: 'Mixed Methods', icon: Sparkles, color: '#14B8A6' },
] as const;

// ============================================================================
// CONSTANTS
// ============================================================================

const BADGE_SIZE = 36;
const ICON_SIZE = 16;
const LOCK_ICON_SIZE = 12;

// ============================================================================
// COMPONENT
// ============================================================================

export const CreationProgressBadges: React.FC = () => {
  const { colors } = useTheme();
  const earnedBadges = useSurveyBuilderStore(selectEarnedBadges);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const hasAnyBadge = earnedBadges.length > 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.card, 0.5),
          borderColor: withAlpha(colors.border, 0.2),
          opacity: fadeAnim,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Creation badges: ${earnedBadges.length} of ${BADGE_DEFS.length} earned`}
    >
      {!hasAnyBadge ? (
        <Text style={[styles.motivationalText, { color: colors.textMuted }]}>
          Start building to earn badges!
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {BADGE_DEFS.map((badge) => {
            const isEarned = earnedBadges.includes(badge.id);
            const IconComponent = badge.icon;

            return (
              <View
                key={badge.id}
                style={styles.badgeItem}
                accessibilityLabel={`${badge.label}: ${isEarned ? 'earned' : 'locked'}`}
              >
                <View
                  style={[
                    styles.badgeCircle,
                    isEarned
                      ? { backgroundColor: withAlpha(badge.color, 0.15), borderColor: badge.color }
                      : { backgroundColor: withAlpha(colors.border, 0.15), borderColor: withAlpha(colors.border, 0.3) },
                  ]}
                >
                  {isEarned ? (
                    <IconComponent size={ICON_SIZE} color={badge.color} />
                  ) : (
                    <Lock size={LOCK_ICON_SIZE} color={colors.textDisabled} />
                  )}
                </View>
                <Text
                  style={[
                    styles.badgeLabel,
                    { color: isEarned ? colors.textSecondary : colors.textDisabled },
                  ]}
                  numberOfLines={1}
                >
                  {badge.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    height: 60,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  motivationalText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  badgeItem: {
    alignItems: 'center',
    gap: SPACING.xxs,
    width: 56,
  },
  badgeCircle: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
});

export default CreationProgressBadges;
