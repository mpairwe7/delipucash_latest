/**
 * EmptyState Component
 * Reusable empty state display with icon and action
 */

import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { 
  Bell, 
  Inbox, 
  Search, 
  CheckCircle,
  LucideIcon,
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';

interface EmptyStateProps {
  type?: 'notifications' | 'search' | 'inbox' | 'success';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  customIcon?: LucideIcon;
}

const getEmptyStateIcon = (type: EmptyStateProps['type']): LucideIcon => {
  const iconMap: Record<NonNullable<EmptyStateProps['type']>, LucideIcon> = {
    notifications: Bell,
    search: Search,
    inbox: Inbox,
    success: CheckCircle,
  };
  return iconMap[type || 'inbox'];
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  customIcon,
}) => {
  const { colors } = useTheme();
  
  const Icon = customIcon || getEmptyStateIcon(type);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING['2xl'],
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(colors.primary, 0.1),
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 280,
    },
    actionButton: {
      marginTop: SPACING.lg,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

  return (
    <Animated.View 
      entering={FadeIn.duration(ANIMATION.duration.normal)}
      style={styles.container}
    >
      <View style={styles.iconContainer}>
        <Icon size={ICON_SIZE.xl} color={colors.primary} />
      </View>
      
      <ThemedText style={styles.title}>{title}</ThemedText>
      
      {description && (
        <ThemedText style={styles.description}>{description}</ThemedText>
      )}
      
      {actionLabel && onAction && (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <ThemedText style={styles.actionLabel}>{actionLabel}</ThemedText>
        </Pressable>
      )}
    </Animated.View>
  );
};

export default EmptyState;
