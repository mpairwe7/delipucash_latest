/**
 * QuickActionCard Component
 * Card for quick support actions with icon and description
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  FileText,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  LucideIcon,
  Settings,
  Shield,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';

import { ThemedText } from '@/components/themed-text';
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';
import type { QuickAction } from '@/services/supportApi';

interface QuickActionCardProps {
  action: QuickAction;
  index?: number;
  onPress?: (action: QuickAction) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getActionIcon = (iconName: string): LucideIcon => {
  const iconMap: Record<string, LucideIcon> = {
    FileText,
    MessageSquare,
    AlertCircle,
    HelpCircle,
    Settings,
    Shield,
    Wallet,
  };
  return iconMap[iconName] || HelpCircle;
};

const getActionColor = (colorName: string, colors: ThemeColors): string => {
  const colorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };
  return colorMap[colorName] || colors.primary;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    containerDisabled: {
      opacity: 0.5,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    contentContainer: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.xxs,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    arrowContainer: {
      marginLeft: SPACING.sm,
      opacity: 0.5,
    },
  });

export const QuickActionCard = memo<QuickActionCardProps>(
  ({ action, index = 0, onPress }) => {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const styles = useMemo(() => createStyles(colors), [colors]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      if (!action.enabled) return;
      scale.value = withSpring(0.98, { stiffness: 400, damping: 15 });
    }, [scale, action.enabled]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, { stiffness: 400, damping: 15 });
    }, [scale]);

    const handlePress = useCallback(() => {
      if (!action.enabled) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(action);
    }, [action, onPress]);

    const Icon = getActionIcon(action.icon);
    const iconColor = getActionColor(action.color, colors);

    return (
      <Animated.View
        entering={FadeInRight.delay(index * 60).duration(
          ANIMATION.duration.normal,
        )}
      >
        <AnimatedPressable
          style={[
            styles.container,
            animatedStyle,
            !action.enabled && styles.containerDisabled,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!action.enabled}
          accessibilityRole="button"
          accessibilityLabel={`${action.title}. ${action.subtitle}`}
          accessibilityHint={
            action.enabled
              ? 'Double tap to open'
              : 'This action is currently unavailable'
          }
          accessibilityState={{ disabled: !action.enabled }}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: withAlpha(iconColor, 0.12) },
            ]}
          >
            <Icon size={ICON_SIZE.sm + 2} color={iconColor} />
          </View>

          <View style={styles.contentContainer}>
            <ThemedText style={styles.title}>{action.title}</ThemedText>
            <ThemedText style={styles.description} numberOfLines={2}>
              {action.subtitle}
            </ThemedText>
          </View>

          <View style={styles.arrowContainer}>
            <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} />
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  },
);
QuickActionCard.displayName = 'QuickActionCard';
