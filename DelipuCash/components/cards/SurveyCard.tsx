/**
 * SurveyCard Component
 * Enhanced survey card with improved UI, animations, and state management
 * 
 * @example
 * ```tsx
 * <SurveyCard
 *   survey={surveyData}
 *   onPress={() => router.push(`/survey/${survey.id}`)}
 *   variant="default"
 * />
 * ```
 */

import React, { useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import {
  Clock,
  Users,
  FileText,
  ChevronRight,
  TrendingUp,
  Calendar,
  CheckCircle2,
  BarChart3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';
import { formatCurrency } from '@/services';
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
  /** Animation delay index for staggered animations */
  index?: number;
  /** Test ID for testing */
  testID?: string;
  /** Show detailed stats */
  showStats?: boolean;
  /** Is current user the survey owner */
  isOwner?: boolean;
  /** Handler for viewing responses (only shown if isOwner is true) */
  onViewResponses?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SurveyCardComponent({
  survey,
  onPress,
  style,
  variant = 'default',
  index = 0,
  testID,
  showStats = true,
  isOwner = false,
  onViewResponses,
}: SurveyCardProps): React.ReactElement {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const progress = useMemo(() => {
    return survey.maxResponses
      ? ((survey.totalResponses || 0) / survey.maxResponses) * 100
      : 0;
  }, [survey.maxResponses, survey.totalResponses]);

  const isScheduled = survey.status === 'scheduled';
  const isCompleted = survey.status === 'completed';

  const statusConfig = useMemo(() => {
    if (isCompleted) {
      return {
        color: colors.textMuted,
        text: 'Completed',
        icon: CheckCircle2,
      };
    }
    if (isScheduled) {
      return {
        color: colors.warning,
        text: 'Upcoming',
        icon: Calendar,
      };
    }
    return {
      color: colors.success,
      text: 'Active',
      icon: TrendingUp,
    };
  }, [isScheduled, isCompleted, colors]);

  const getTimeRemaining = useCallback((): string => {
    const now = new Date();

    if (isScheduled) {
      const startDate = new Date(survey.startDate);
      const diffMs = startDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return 'Starting soon';
      if (diffDays === 1) return 'Starts tomorrow';
      return `Starts in ${diffDays} days`;
    }

    const endDate = new Date(survey.endDate);
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    
    if (diffMs < 0) return 'Ended';
    if (diffHours < 24) return `${diffHours}h left`;
    if (diffDays === 1) return '1 day left';
    if (diffDays <= 7) return `${diffDays} days left`;
    return `${diffDays} days`;
  }, [isScheduled, survey.startDate, survey.endDate]);

  const questionsCount = useMemo(() => {
    return survey.uploads?.length || 4;
  }, [survey.uploads]);

  const estimatedTime = useMemo(() => {
    return Math.max(2, Math.ceil(questionsCount * 0.5));
  }, [questionsCount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  const StatusIcon = statusConfig.icon;

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(300)}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.border },
          variant === 'compact' && styles.containerCompact,
          variant === 'featured' && [styles.containerFeatured, { borderColor: withAlpha(colors.primary, 0.3) }],
          animatedStyle,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Survey: ${survey.title}`}
        accessibilityHint={`${statusConfig.text}, ${getTimeRemaining()}, ${formatCurrency(survey.rewardAmount || 0)} reward`}
        testID={testID}
      >
        {/* Header: Status & Reward */}
        <View style={styles.header}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: withAlpha(statusConfig.color, 0.12) },
            ]}
          >
            <StatusIcon size={12} color={statusConfig.color} strokeWidth={2} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </View>

          <View
            style={[
              styles.rewardBadge,
              { backgroundColor: withAlpha(colors.success, 0.12) },
            ]}
          >
            <Text style={[styles.rewardText, { color: colors.success }]}>
              {formatCurrency(survey.rewardAmount || 0)}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }, variant === 'compact' && styles.titleCompact]} numberOfLines={2}>
          {survey.title}
        </Text>

        {/* Description (not in compact mode) */}
        {variant !== 'compact' && survey.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {survey.description}
          </Text>
        )}

        {/* Progress Bar (only for active surveys) */}
        {!isScheduled && showStats && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Responses</Text>
              <Text style={[styles.progressValue, { color: colors.text }]}>
                {survey.totalResponses || 0}/{survey.maxResponses || 0}
              </Text>
            </View>
            <View style={[styles.progressBarContainer, { backgroundColor: withAlpha(colors.primary, 0.12) }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: colors.primary, width: `${Math.min(progress, 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Meta Info */}
        <View style={styles.metaGrid}>
          <View style={[styles.metaItem, { backgroundColor: withAlpha(colors.text, 0.04) }]}>
            <Clock size={12} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{getTimeRemaining()}</Text>
          </View>
          <View style={[styles.metaItem, { backgroundColor: withAlpha(colors.text, 0.04) }]}>
            <FileText size={12} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{questionsCount} questions</Text>
          </View>
          <View style={[styles.metaItem, { backgroundColor: withAlpha(colors.text, 0.04) }]}>
            <Users size={12} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>~{estimatedTime} min</Text>
          </View>
        </View>

        {/* Owner Actions - View Responses */}
        {isOwner && onViewResponses && variant !== 'compact' && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onViewResponses();
            }}
            style={[
              styles.viewResponsesBtn,
              { backgroundColor: withAlpha(colors.info, 0.12), borderColor: withAlpha(colors.info, 0.3) },
            ]}
          >
            <BarChart3 size={16} color={colors.info} strokeWidth={2} />
            <Text style={[styles.viewResponsesText, { color: colors.info }]}>
              View Responses ({survey.totalResponses || 0})
            </Text>
          </Pressable>
        )}

        {/* Footer with CTA */}
        {variant !== 'compact' && (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.statsRow}>
              {survey.totalResponses && survey.totalResponses > 0 && (
                <View style={styles.statItem}>
                  <TrendingUp size={12} color={colors.success} strokeWidth={1.5} />
                  <Text style={[styles.statText, { color: colors.success }]}>
                    {Math.round(progress)}% filled
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionHint}>
              <Text style={[styles.actionText, { color: colors.primary }]}>
                {isOwner ? 'Edit survey' : isScheduled ? 'View details' : 'Take survey'}
              </Text>
              <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
            </View>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  containerCompact: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  containerFeatured: {
    borderWidth: 1.5,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    gap: SPACING.xxs,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xs,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.3,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  progressLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  progressValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  viewResponsesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  viewResponsesText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// Memoize to prevent unnecessary re-renders in lists
export const SurveyCard = memo(SurveyCardComponent);
SurveyCard.displayName = 'SurveyCard';

export default SurveyCard;
