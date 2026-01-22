/**
 * Notifications Screen
 * Comprehensive notification center with filtering and actions
 * Design System Compliant - Uses theme tokens and reusable components
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCheck,
  Settings,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import {
  NotificationItemComponent,
  NotificationFilters,
  NotificationBadge,
  EmptyState,
  type FilterOption,
} from '@/components/notifications';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme } from '@/utils/theme';

import {
  initializeNotifications,
  fetchNotifications,
  fetchNotificationStats,
  markAsRead,
  markAllAsRead,
  type NotificationItem,
  type NotificationStats,
  type NotificationFilters as NotificationFiltersType,
  type NotificationCategory,
} from '@/services/notificationApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function NotificationsScreen() {
  const { colors, statusBarStyle } = useTheme();
  const router = useRouter();

  // State
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);

  // Derived state
  const unreadCount = stats?.unread ?? 0;
  const hasUnread = unreadCount > 0;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [notificationData, statsData] = await Promise.all([
        fetchNotifications(),
        fetchNotificationStats(),
      ]);

      setNotifications(notificationData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filterNotifications = useCallback(async () => {
    try {
      let filters: NotificationFiltersType = {};

      if (selectedFilter === 'unread') {
        filters.read = false;
      } else if (selectedFilter !== 'all') {
        filters.category = selectedFilter as NotificationCategory;
      }

      const data = await fetchNotifications(filters);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to filter notifications:', error);
    }
  }, [selectedFilter]);

  // Initialize and load data
  useEffect(() => {
    initializeNotifications('user_123');
    loadData();
  }, [loadData]);

  // Reload when filter changes
  useEffect(() => {
    if (!isLoading) {
      filterNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter, filterNotifications]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  const handleFilterChange = useCallback((filter: FilterOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
  }, []);

  const handleNotificationPress = useCallback((notification: NotificationItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Navigate to action URL if available
    if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
    }
  }, [router]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: true, readAt: new Date().toISOString() }
            : n
        )
      );

      // Update stats
      setStats(prev =>
        prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : null
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All Read',
          onPress: async () => {
            try {
              await markAllAsRead();
              
              // Update local state
              setNotifications(prev =>
                prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
              );

              // Update stats
              setStats(prev => (prev ? { ...prev, unread: 0, urgent: 0 } : null));

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Failed to mark all as read:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ]
    );
  }, []);

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to notification settings
    router.push('/(tabs)/profile' as any);
  }, [router]);

  // Styles
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    headerContent: {
      flex: 1,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    headerBadge: {
      marginLeft: SPACING.xs,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    headerActionButton: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    actionsInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionsInfoText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    actionsButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.background,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.primary,
      marginLeft: SPACING.xxs,
    },
    listContainer: {
      flex: 1,
    },
    listContent: {
      padding: SPACING.md,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    summaryItem: {
      alignItems: 'center',
    },
    summaryNumber: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: SPACING.xxs,
      textTransform: 'uppercase',
    },
    separator: {
      width: 1,
      backgroundColor: colors.border,
    },
  });

  const renderNotification = useCallback(
    ({ item, index }: { item: NotificationItem; index: number }) => (
      <NotificationItemComponent
        notification={item}
        index={index}
        onPress={handleNotificationPress}
        onMarkAsRead={handleMarkAsRead}
      />
    ),
    [handleNotificationPress, handleMarkAsRead]
  );

  const renderHeader = useCallback(() => {
    if (!stats) return null;

    return (
      <>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION.duration.normal)}
          style={styles.summaryCard}
        >
          <View style={styles.summaryItem}>
            <ThemedText style={styles.summaryNumber}>{stats.total}</ThemedText>
            <ThemedText style={styles.summaryLabel}>Total</ThemedText>
          </View>
          <View style={styles.separator} />
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryNumber, { color: colors.primary }]}>
              {stats.unread}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Unread</ThemedText>
          </View>
          <View style={styles.separator} />
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryNumber, { color: colors.error }]}>
              {stats.urgent}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Urgent</ThemedText>
          </View>
        </Animated.View>

        <NotificationFilters
          selectedFilter={selectedFilter}
          onFilterChange={handleFilterChange}
          unreadCount={stats.unread}
          categoryCounts={stats.byCategory}
        />
      </>
    );
  }, [stats, selectedFilter, handleFilterChange, colors, styles]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    const emptyConfig = {
      all: {
        title: 'No notifications yet',
        description: 'When you receive notifications, they will appear here',
      },
      unread: {
        title: 'All caught up!',
        description: "You've read all your notifications",
      },
      default: {
        title: 'No notifications',
        description: `No ${selectedFilter} notifications found`,
      },
    };

    const config =
      emptyConfig[selectedFilter as keyof typeof emptyConfig] || emptyConfig.default;

    return (
      <EmptyState
        type={selectedFilter === 'unread' ? 'success' : 'notifications'}
        title={config.title}
        description={config.description}
      />
    );
  }, [isLoading, selectedFilter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(ANIMATION.duration.normal)}
        style={styles.header}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={ICON_SIZE.sm} color={colors.text} />
        </Pressable>

        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
            {hasUnread && (
              <View style={styles.headerBadge}>
                <NotificationBadge count={unreadCount} size="sm" />
              </View>
            )}
          </View>
          <ThemedText style={styles.headerSubtitle}>
            {hasUnread ? `${unreadCount} unread` : 'All caught up'}
          </ThemedText>
        </View>

        <View style={styles.headerActions}>
          {hasUnread && (
            <Animated.View
              entering={SlideInRight.duration(ANIMATION.duration.fast)}
            >
              <Pressable
                style={styles.headerActionButton}
                onPress={handleMarkAllAsRead}
              >
                <CheckCheck size={ICON_SIZE.sm} color={colors.primary} />
              </Pressable>
            </Animated.View>
          )}
          <Pressable
            style={styles.headerActionButton}
            onPress={handleSettingsPress}
          >
            <Settings size={ICON_SIZE.sm} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
