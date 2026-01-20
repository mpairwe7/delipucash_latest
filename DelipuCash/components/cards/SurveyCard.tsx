/**
 * SurveyCard Component
 * Displays survey information with progress and reward
 * 
 * @example
 * ```tsx
 * <SurveyCard
 *   survey={surveyData}
 *   onPress={() => router.push(`/survey/${survey.id}`)}
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
import { Clock, Users, DollarSign } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { Survey } from '@/types';

export interface SurveyCardProps {
  /** Survey data object */
  survey: Survey;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default, compact, or featured */
  variant?: 'default' | 'compact' | 'featured';
  /** Test ID for testing */
  testID?: string;
}

export function SurveyCard({
  survey,
  onPress,
  style,
  variant = 'default',
  testID,
}: SurveyCardProps): React.ReactElement {
  const { colors } = useTheme();

  const progress = survey.maxResponses
    ? ((survey.totalResponses || 0) / survey.maxResponses) * 100
    : 0;

  const isScheduled = survey.status === 'scheduled';
  const statusColor = isScheduled ? colors.warning : colors.success;
  const statusText = isScheduled ? 'Upcoming' : 'Running';

  const getTimeRemaining = (): string => {
    const endDate = new Date(survey.endDate);
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Ended';
    if (diffDays === 0) return 'Ends today';
    if (diffDays === 1) return '1 day left';
    return `${diffDays} days left`;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Survey: ${survey.title}`}
      testID={testID}
      style={[
        styles.container,
        variant === 'compact' && styles.containerCompact,
        variant === 'featured' && styles.containerFeatured,
        { backgroundColor: colors.card },
        style,
      ]}
    >
      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: withAlpha(statusColor, 0.15) },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusText}
        </Text>
      </View>

      {/* Title & Description */}
      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
      >
        {survey.title}
      </Text>
      {variant !== 'compact' && survey.description && (
        <Text
          style={[styles.description, { color: colors.textMuted }]}
          numberOfLines={2}
        >
          {survey.description}
        </Text>
      )}

      {/* Progress Bar */}
      {!isScheduled && (
        <View style={styles.progressContainer}>
          <View
            style={[styles.progressBar, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.min(progress, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>
            {survey.totalResponses || 0}/{survey.maxResponses || 0}
          </Text>
        </View>
      )}

      {/* Meta Info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={14} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {getTimeRemaining()}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <DollarSign size={14} color={colors.success} strokeWidth={1.5} />
          <Text style={[styles.metaText, { color: colors.success }]}>
            ${survey.rewardAmount?.toFixed(2) || '0.00'}
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
  containerFeatured: {
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xs,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    minWidth: 50,
    textAlign: 'right',
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
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default SurveyCard;
