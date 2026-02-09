/**
 * StatCard Component
 * Reusable statistics card following design system guidelines
 * 
 * @example
 * ```tsx
 * <StatCard
 *   icon={<TrendingUp size={20} color={colors.success} />}
 *   title="Total Earnings"
 *   value="$1,240"
 *   subtitle="+12% this week"
 *   onPress={() => router.push('/earnings')}
 * />
 * ```
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
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
} from '@/utils/theme';
import { triggerHaptic } from '@/utils/quiz-utils';

export interface StatCardProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Main title/label */
  title: string;
  /** Primary value to display */
  value: string | number;
  /** Optional subtitle or trend indicator */
  subtitle?: string;
  /** Optional subtitle color override */
  subtitleColor?: string;
  /** Optional press handler */
  onPress?: () => void;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Card variant: default or compact */
  variant?: 'default' | 'compact';
  /** Test ID for testing */
  testID?: string;
}

function StatCardComponent({
  icon,
  title,
  value,
  subtitle,
  subtitleColor,
  onPress,
  style,
  variant = 'default',
  testID,
}: StatCardProps): React.ReactElement {
  const { colors } = useTheme();

  const content = (
    <View
      style={[
        styles.container,
        variant === 'compact' && styles.containerCompact,
        { backgroundColor: colors.card },
        style,
      ]}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text
        style={[
          styles.value,
          variant === 'compact' && styles.valueCompact,
          { color: colors.text },
        ]}
        numberOfLines={1}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text
        style={[styles.title, { color: colors.textMuted }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            { color: subtitleColor || colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          triggerHaptic('light');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${value}`}
        accessibilityHint={`Tap to view ${title.toLowerCase()} details`}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  containerCompact: {
    padding: SPACING.md,
  },
  iconContainer: {
    marginBottom: SPACING.md,
  },
  value: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginBottom: SPACING.xs,
  },
  valueCompact: {
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
  },
});

export const StatCard = memo(StatCardComponent);
StatCard.displayName = 'StatCard';

export default StatCard;
