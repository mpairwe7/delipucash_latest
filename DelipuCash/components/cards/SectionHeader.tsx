/**
 * SectionHeader Component
 * Reusable section header with optional "See All" action
 * 
 * @example
 * ```tsx
 * <SectionHeader
 *   title="Trending Videos"
 *   subtitle="Most watched this week"
 *   onSeeAll={() => router.push('/videos')}
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
import { ChevronRight } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
} from '@/utils/theme';

export interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** "See All" press handler - shows action button when provided */
  onSeeAll?: () => void;
  /** Custom action text */
  actionText?: string;
  /** Custom icon before title */
  icon?: React.ReactNode;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

export function SectionHeader({
  title,
  subtitle,
  onSeeAll,
  actionText = 'See All',
  icon,
  style,
  testID,
}: SectionHeaderProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.leftSection}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          style={styles.actionButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${actionText} ${title}`}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {actionText}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.sm,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginRight: 2,
  },
});

export default SectionHeader;
