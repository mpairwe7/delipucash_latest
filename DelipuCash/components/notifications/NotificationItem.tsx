/**
 * NotificationItem Component
 * Card component for individual notification with swipe actions
 */

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { 
  DollarSign,
  Star,
  ClipboardList,
  Shield,
  Trophy,
  Users,
  Sparkles,
  Bell,
  CreditCard,
  ChevronRight,
  LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
import type { NotificationItem as NotificationItemType, NotificationCategory } from '@/services/notificationApi';

interface NotificationItemProps {
  notification: NotificationItemType;
  index?: number;
  onPress?: (notification: NotificationItemType) => void;
  onMarkAsRead?: (id: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface IconConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const getNotificationIcon = (
  category: NotificationCategory,
  colors: any
): IconConfig => {
  const configs: Record<NotificationCategory, IconConfig> = {
    payments: {
      icon: DollarSign,
      color: colors.success,
      bgColor: withAlpha(colors.success, 0.12),
    },
    rewards: {
      icon: Star,
      color: colors.warning,
      bgColor: withAlpha(colors.warning, 0.12),
    },
    surveys: {
      icon: ClipboardList,
      color: colors.info,
      bgColor: withAlpha(colors.info, 0.12),
    },
    subscription: {
      icon: CreditCard,
      color: colors.primary,
      bgColor: withAlpha(colors.primary, 0.12),
    },
    security: {
      icon: Shield,
      color: colors.error,
      bgColor: withAlpha(colors.error, 0.12),
    },
    achievements: {
      icon: Trophy,
      color: colors.warning,
      bgColor: withAlpha(colors.warning, 0.12),
    },
    referrals: {
      icon: Users,
      color: colors.success,
      bgColor: withAlpha(colors.success, 0.12),
    },
    welcome: {
      icon: Sparkles,
      color: colors.primary,
      bgColor: withAlpha(colors.primary, 0.12),
    },
    general: {
      icon: Bell,
      color: colors.textSecondary,
      bgColor: withAlpha(colors.textSecondary, 0.12),
    },
  };

  return configs[category] || configs.general;
};

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const NotificationItemComponent: React.FC<NotificationItemProps> = ({
  notification,
  index = 0,
  onPress,
  onMarkAsRead,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const iconConfig = useMemo(
    () => getNotificationIcon(notification.category, colors),
    [notification.category, colors]
  );

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
    
    if (!notification.read) {
      onMarkAsRead?.(notification.id);
    }
    
    onPress?.(notification);
  }, [notification, onPress, onMarkAsRead]);

  const isUrgent = notification.priority === 'URGENT' && !notification.read;

  const Icon = iconConfig.icon;

  const styles = StyleSheet.create({
    container: {
      backgroundColor: notification.read ? colors.card : withAlpha(colors.primary, 0.05),
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: isUrgent ? colors.error : colors.border,
      borderLeftWidth: isUrgent ? 3 : 1,
      borderLeftColor: isUrgent ? colors.error : colors.border,
      flexDirection: 'row',
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: iconConfig.bgColor,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    contentContainer: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xxs,
    },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: notification.read ? '500' : '600',
      color: colors.text,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      marginRight: SPACING.xs,
    },
    urgentBadge: {
      backgroundColor: withAlpha(colors.error, 0.15),
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      borderRadius: RADIUS.xs,
      marginLeft: SPACING.xs,
    },
    urgentText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.error,
      textTransform: 'uppercase',
    },
    body: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      marginBottom: SPACING.xs,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timeText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    actionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
      marginRight: SPACING.xxs,
    },
    categoryBadge: {
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      borderRadius: RADIUS.xs,
      marginLeft: SPACING.xs,
    },
    categoryText: {
      fontSize: 10,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
  });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(ANIMATION.duration.normal)}
    >
      <AnimatedPressable
        style={[styles.container, animatedStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.iconContainer}>
          <Icon size={ICON_SIZE.sm + 2} color={iconConfig.color} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            {!notification.read && <View style={styles.unreadDot} />}
            <ThemedText style={styles.title} numberOfLines={1}>
              {notification.title}
            </ThemedText>
            {isUrgent && (
              <View style={styles.urgentBadge}>
                <ThemedText style={styles.urgentText}>Urgent</ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={styles.body} numberOfLines={2}>
            {notification.body}
          </ThemedText>

          <View style={styles.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ThemedText style={styles.timeText}>
                {formatTimeAgo(notification.createdAt)}
              </ThemedText>
              <View style={styles.categoryBadge}>
                <ThemedText style={styles.categoryText}>
                  {notification.category}
                </ThemedText>
              </View>
            </View>

            {notification.actionText && (
              <View style={styles.actionContainer}>
                <ThemedText style={styles.actionText}>
                  {notification.actionText}
                </ThemedText>
                <ChevronRight size={12} color={colors.primary} />
              </View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

export default NotificationItemComponent;
