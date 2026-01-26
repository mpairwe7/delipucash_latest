/**
 * ProfileNotificationCard Component
 * Card for navigating to Notifications from profile screen with unread count
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { 
  Bell, 
  ChevronRight,
  Shield,
  Star,
  CreditCard,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { NotificationBadge } from '@/components/notifications';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
import { getUnreadCount, initializeNotifications } from '@/services/notificationApi';

interface ProfileNotificationCardProps {
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ProfileNotificationCard: React.FC<ProfileNotificationCardProps> = ({
  index = 0,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initialize notifications and get count
    initializeNotifications('user_123');
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to get unread count:', error);
    }
  };

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
    router.push('/notifications-screen' as any);
  }, [router]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.lg,
      backgroundColor: withAlpha(colors.warning, 0.12),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
      position: 'relative',
    },
    badgeContainer: {
      position: 'absolute',
      top: -4,
      right: -4,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    arrow: {
      opacity: 0.5,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    statValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
      textTransform: 'uppercase',
    },
  });

  const stats = [
    { icon: Bell, label: 'Unread', value: unreadCount, color: colors.warning },
    { icon: Shield, label: 'Security', value: 1, color: colors.error },
    { icon: Star, label: 'Rewards', value: 3, color: colors.success },
    { icon: CreditCard, label: 'Payments', value: 2, color: colors.info },
  ];

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(ANIMATION.duration.normal)}>
      <AnimatedPressable
        style={[styles.container, animatedStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Bell size={ICON_SIZE.md} color={colors.warning} />
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <NotificationBadge count={unreadCount} size="sm" />
            </View>
          )}
        </View>
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>Notifications</ThemedText>
          <ThemedText style={styles.subtitle}>
            {unreadCount > 0 
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </ThemedText>
        </View>
        <View style={styles.arrow}>
          <ChevronRight size={ICON_SIZE.sm} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.statsContainer}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <View key={idx} style={styles.statItem}>
              <View style={styles.statIcon}>
                <Icon size={ICON_SIZE.xs + 2} color={stat.color} />
              </View>
              <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
              <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
            </View>
          );
        })}
      </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

export default ProfileNotificationCard;
