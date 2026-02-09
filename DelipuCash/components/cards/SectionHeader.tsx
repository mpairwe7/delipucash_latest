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

import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
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
import { triggerHaptic } from '@/utils/quiz-utils';

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

function SectionHeaderComponent({
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
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            onSeeAll();
          }}
          style={styles.actionButton}
          accessibilityRole="button"
          accessibilityLabel={`${actionText} ${title}`}
          accessibilityHint={`Tap to see all ${title.toLowerCase()}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {actionText}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
        </Pressable>
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

export const SectionHeader = memo(SectionHeaderComponent);
SectionHeader.displayName = 'SectionHeader';

export default SectionHeader;
