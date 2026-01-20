/**
 * ProgressCard Component
 * Displays progress towards a goal with visual indicator
 * 
 * @example
 * ```tsx
 * <ProgressCard
 *   title="Weekly Goal"
 *   current={750}
 *   goal={1000}
 *   unit="points"
 *   icon={<Target size={20} color={colors.primary} />}
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
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

export interface ProgressCardProps {
  /** Card title */
  title: string;
  /** Current progress value */
  current: number;
  /** Goal/target value */
  goal: number;
  /** Unit label (e.g., "points", "surveys") */
  unit?: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Progress bar color override */
  progressColor?: string;
  /** Press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Show percentage instead of values */
  showPercentage?: boolean;
  /** Test ID for testing */
  testID?: string;
}

export function ProgressCard({
  title,
  current,
  goal,
  unit = '',
  icon,
  progressColor,
  onPress,
  style,
  showPercentage = false,
  testID,
}: ProgressCardProps): React.ReactElement {
  const { colors } = useTheme();

  const progress = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const barColor = progressColor || colors.primary;

  const content = (
    <View
      style={[styles.container, { backgroundColor: colors.card }, style]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>

      {/* Progress Info */}
      <View style={styles.progressInfo}>
        <Text style={[styles.currentValue, { color: colors.text }]}>
          {current.toLocaleString()}
          {unit && <Text style={styles.unit}> {unit}</Text>}
        </Text>
        <Text style={[styles.goalValue, { color: colors.textMuted }]}>
          {showPercentage
            ? `${Math.round(progress)}%`
            : `/ ${goal.toLocaleString()} ${unit}`}
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: barColor,
              width: `${progress}%`,
            },
          ]}
        />
      </View>

      {/* Milestone Indicators */}
      <View style={styles.milestones}>
        {[25, 50, 75, 100].map((milestone) => (
          <View
            key={milestone}
            style={[
              styles.milestone,
              progress >= milestone && { backgroundColor: barColor },
              progress < milestone && { backgroundColor: colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current} of ${goal} ${unit}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  currentValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  unit: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  goalValue: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginLeft: SPACING.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  milestones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs,
  },
  milestone: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ProgressCard;
