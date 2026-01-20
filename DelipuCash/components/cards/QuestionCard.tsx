/**
 * QuestionCard Component
 * Displays question with reward and engagement info
 * 
 * @example
 * ```tsx
 * <QuestionCard
 *   question={questionData}
 *   onPress={() => router.push(`/question/${question.id}`)}
 * />
 * ```
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { MessageCircle, DollarSign, Zap } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { Question } from '@/types';

export interface QuestionCardProps {
  /** Question data object */
  question: Question;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default or compact */
  variant?: 'default' | 'compact';
  /** Test ID for testing */
  testID?: string;
}

export function QuestionCard({
  question,
  onPress,
  style,
  variant = 'default',
  testID,
}: QuestionCardProps): React.ReactElement {
  const { colors } = useTheme();

  const getCategoryColor = (category?: string): string => {
    const categoryColors: Record<string, string> = {
      Technology: colors.info,
      Lifestyle: colors.success,
      Finance: colors.warning,
      Business: colors.primary,
      Health: '#10B981',
      Education: '#8B5CF6',
    };
    return categoryColors[category || ''] || colors.textMuted;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Question: ${question.text}`}
      testID={testID}
      style={[
        styles.container,
        variant === 'compact' && styles.containerCompact,
        { backgroundColor: colors.card },
        style,
      ]}
    >
      {/* Category & Instant Reward Badge */}
      <View style={styles.headerRow}>
        {question.category && (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: withAlpha(getCategoryColor(question.category), 0.15) },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: getCategoryColor(question.category) },
              ]}
            >
              {question.category}
            </Text>
          </View>
        )}
        {question.isInstantReward && (
          <View
            style={[
              styles.instantBadge,
              { backgroundColor: withAlpha(colors.warning, 0.15) },
            ]}
          >
            <Zap size={10} color={colors.warning} fill={colors.warning} />
            <Text style={[styles.instantText, { color: colors.warning }]}>
              Instant
            </Text>
          </View>
        )}
      </View>

      {/* Question Text */}
      <Text
        style={[styles.questionText, { color: colors.text }]}
        numberOfLines={variant === 'compact' ? 2 : 3}
      >
        {question.text}
      </Text>

      {/* Meta Info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MessageCircle size={14} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {question.totalAnswers || 0} answers
          </Text>
        </View>
        <View style={styles.rewardContainer}>
          <DollarSign size={14} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.rewardText, { color: colors.success }]}>
            {question.rewardAmount?.toFixed(2) || '0.00'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  containerCompact: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  categoryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 2,
  },
  instantText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  questionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default QuestionCard;
