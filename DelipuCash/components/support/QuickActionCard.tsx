/**
 * QuickActionCard Component
 * Card for quick support actions with icon and description
 */

import React, { useCallback } from 'react';
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
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
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

const getActionColor = (colorName: string, colors: any): string => {
  const colorMap: Record<string, string> = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
  };
  return colorMap[colorName] || colors.primary;
};

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  action,
  index = 0,
  onPress,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

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
    onPress?.(action);
  }, [action, onPress]);

  const Icon = getActionIcon(action.icon);
  const iconColor = getActionColor(action.color, colors);

  const styles = StyleSheet.create({
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
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: withAlpha(iconColor, 0.12),
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

  return (
    <AnimatedPressable
      entering={FadeInRight.delay(index * 60).duration(ANIMATION.duration.normal)}
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.iconContainer}>
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
  );
};

export default QuickActionCard;
