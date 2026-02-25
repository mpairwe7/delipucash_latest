/**
 * Notifications Screen — Industry-standard notification center.
 *
 * Architecture mirrors transactions.tsx:
 * - Infinite scroll with server-side pagination
 * - Date-grouped heterogeneous FlatList (sections + items)
 * - Zustand persisted filter + transient detail ID
 * - Adaptive polling (SSE primary, polling fallback)
 * - Skeleton shimmer loading
 * - Bottom sheet detail view
 * - Swipeable actions (mark read, archive, delete)
 * - Memoized components, ID-based callbacks, animation cap
 */

import React, { memo, useCallback, useRef, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Href, useFocusEffect } from "expo-router";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Inbox,
  Shield,
  Star,
  ClipboardList,
  Trophy,
  Users,
  Sparkles,
  AlertTriangle,
  Archive,
  Trash2,
  Eye,
  LucideIcon,
} from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "@/utils/haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Swipeable } from "react-native-gesture-handler";
import { formatDistanceToNow } from "date-fns";

import { useStatusBar } from "@/hooks/useStatusBar";
import { ThemeColors, withAlpha } from "@/utils/theme";
import { usePushNotifications } from "@/utils/usePushNotifications";
import {
  useFlatNotifications,
  useNotificationStats,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useArchiveNotification,
  type NotificationFlatListItem,
  type DateSection,
} from "@/services/notificationHooks";
import {
  useNotificationUIStore,
  selectNotificationFilter,
  selectSelectedNotificationId,
  selectSetNotificationFilter,
  selectOpenNotificationDetail,
  selectCloseNotificationDetail,
} from "@/store";
import type { Notification, NotificationFilterType } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ANIMATED_INDEX = 15;
const SKELETON_COUNT = 5;

type FilterOption = { id: NotificationFilterType; label: string };
const FILTERS: FilterOption[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "payments", label: "Payments" },
  { id: "rewards", label: "Rewards" },
  { id: "surveys", label: "Surveys" },
  { id: "security", label: "Security" },
  { id: "subscription", label: "Subscription" },
  { id: "achievements", label: "Achievements" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryIcon(category: string | null): LucideIcon {
  switch (category) {
    case "payments":
      return DollarSign;
    case "rewards":
      return Star;
    case "surveys":
      return ClipboardList;
    case "security":
      return Shield;
    case "achievements":
      return Trophy;
    case "referrals":
      return Users;
    case "subscription":
      return CreditCard;
    case "welcome":
      return Sparkles;
    default:
      return Bell;
  }
}

function getCategoryColor(category: string | null, colors: ThemeColors): string {
  switch (category) {
    case "payments":
      return colors.success;
    case "rewards":
      return colors.warning;
    case "surveys":
      return colors.primary;
    case "security":
      return colors.error;
    case "achievements":
      return "#F59E0B";
    case "referrals":
      return "#8B5CF6";
    case "subscription":
      return colors.info ?? colors.primary;
    default:
      return colors.textMuted;
  }
}

function getPriorityColor(priority: string, colors: ThemeColors): string {
  switch (priority) {
    case "URGENT":
      return colors.error;
    case "HIGH":
      return colors.warning;
    default:
      return "transparent";
  }
}

function getEmptyState(filter: NotificationFilterType) {
  switch (filter) {
    case "unread":
      return {
        Icon: CheckCheck,
        title: "All caught up!",
        subtitle: "You've read all your notifications",
      };
    case "payments":
      return {
        Icon: DollarSign,
        title: "No payment notifications",
        subtitle: "Payment updates will appear here",
      };
    case "rewards":
      return {
        Icon: Star,
        title: "No reward notifications",
        subtitle: "Earn rewards to see updates here",
      };
    case "surveys":
      return {
        Icon: ClipboardList,
        title: "No survey notifications",
        subtitle: "Survey updates will appear here",
      };
    case "security":
      return {
        Icon: Shield,
        title: "No security alerts",
        subtitle: "Security notifications will appear here",
      };
    case "subscription":
      return {
        Icon: CreditCard,
        title: "No subscription updates",
        subtitle: "Subscription notifications will appear here",
      };
    case "achievements":
      return {
        Icon: Trophy,
        title: "No achievements yet",
        subtitle: "Keep going to unlock achievements",
      };
    default:
      return {
        Icon: Inbox,
        title: "No notifications yet",
        subtitle:
          "Stay tuned — updates from surveys, rewards, and payments will appear here",
      };
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

const SkeletonPulse = memo<{ colors: ThemeColors; style?: object }>(
  ({ colors, style }) => {
    const opacity = useSharedValue(0.3);

    React.useEffect(() => {
      opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      backgroundColor: colors.border,
    }));

    return <Animated.View style={[animatedStyle, style]} />;
  },
);
SkeletonPulse.displayName = "SkeletonPulse";

const NotificationCardSkeleton = memo<{ colors: ThemeColors }>(
  ({ colors }) => (
    <View
      style={[styles.notificationCard, { backgroundColor: colors.card }]}
    >
      <View style={styles.cardRow}>
        <SkeletonPulse
          colors={colors}
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
        <View style={styles.cardDetails}>
          <SkeletonPulse
            colors={colors}
            style={{ width: "70%", height: 14, borderRadius: 6 }}
          />
          <SkeletonPulse
            colors={colors}
            style={{ width: "90%", height: 12, borderRadius: 6, marginTop: 6 }}
          />
          <SkeletonPulse
            colors={colors}
            style={{ width: "40%", height: 10, borderRadius: 4, marginTop: 6 }}
          />
        </View>
      </View>
    </View>
  ),
);
NotificationCardSkeleton.displayName = "NotificationCardSkeleton";

const SummarySkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
    <SkeletonPulse
      colors={colors}
      style={{ width: 60, height: 28, borderRadius: 8 }}
    />
    <View style={styles.summarySeparator} />
    <SkeletonPulse
      colors={colors}
      style={{ width: 60, height: 28, borderRadius: 8 }}
    />
    <View style={styles.summarySeparator} />
    <SkeletonPulse
      colors={colors}
      style={{ width: 60, height: 28, borderRadius: 8 }}
    />
  </View>
));
SummarySkeleton.displayName = "SummarySkeleton";

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  stats:
    | { total: number; unread: number; categories: Record<string, number>; priorities?: Record<string, number> }
    | undefined;
  colors: ThemeColors;
  isLoading: boolean;
}

const NotificationSummaryCard = memo<SummaryCardProps>(
  ({ stats, colors, isLoading }) => {
    if (isLoading || !stats) return <SummarySkeleton colors={colors} />;

    const urgentCount = stats.priorities?.URGENT ?? 0;
    return (
      <Animated.View
        entering={FadeInDown.springify()}
        style={[styles.summaryCard, { backgroundColor: colors.card }]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: colors.text }]}>
            {stats.total}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Total
          </Text>
        </View>

        <View
          style={[styles.summarySeparator, { backgroundColor: colors.border }]}
        />

        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, { color: colors.primary }]}>
            {stats.unread}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Unread
          </Text>
        </View>

        <View
          style={[styles.summarySeparator, { backgroundColor: colors.border }]}
        />

        <View style={styles.summaryItem}>
          <Text
            style={[
              styles.summaryNumber,
              { color: urgentCount > 0 ? colors.error : colors.success },
            ]}
          >
            {urgentCount}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Urgent
          </Text>
        </View>
      </Animated.View>
    );
  },
);
NotificationSummaryCard.displayName = "NotificationSummaryCard";

// ---------------------------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  filterId: NotificationFilterType;
  label: string;
  count: number;
  isActive: boolean;
  colors: ThemeColors;
  onFilterPress: (id: NotificationFilterType) => void;
}

const FilterChip = memo<FilterChipProps>(
  ({ filterId, label, count, isActive, colors, onFilterPress }) => {
    const handlePress = useCallback(
      () => onFilterPress(filterId),
      [filterId, onFilterPress],
    );

    return (
      <TouchableOpacity
        style={[
          styles.filterChip,
          {
            backgroundColor: isActive ? colors.primary : colors.card,
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Filter by ${label}${count > 0 ? `, ${count} items` : ""}`}
        accessibilityState={{ selected: isActive }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            { color: isActive ? "#fff" : colors.text },
          ]}
        >
          {label}
        </Text>
        {count > 0 && (
          <View
            style={[
              styles.chipBadge,
              {
                backgroundColor: isActive
                  ? "rgba(255,255,255,0.25)"
                  : `${colors.textMuted}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.chipBadgeText,
                { color: isActive ? "#fff" : colors.textMuted },
              ]}
            >
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);
FilterChip.displayName = "FilterChip";

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

const SectionHeader = memo<{ title: DateSection; colors: ThemeColors }>(
  ({ title, colors }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
    </View>
  ),
);
SectionHeader.displayName = "SectionHeader";

// ---------------------------------------------------------------------------
// Notification Card (Swipeable)
// ---------------------------------------------------------------------------

interface NotificationCardProps {
  notification: Notification;
  colors: ThemeColors;
  index: number;
  onPress: (id: string) => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const NotificationCard = memo<NotificationCardProps>(
  ({ notification, colors, index, onPress, onMarkRead, onArchive, onDelete }) => {
    const swipeableRef = useRef<Swipeable>(null);
    const isUnread = !notification.read;
    const isUrgent = notification.priority === "URGENT";
    const categoryColor = getCategoryColor(notification.category, colors);
    const IconComp = getCategoryIcon(notification.category);

    const handlePress = useCallback(() => {
      if (isUnread) onMarkRead(notification.id);
      onPress(notification.id);
    }, [notification.id, isUnread, onPress, onMarkRead]);

    const renderLeftActions = useCallback(
      () =>
        isUnread ? (
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              onMarkRead(notification.id);
              swipeableRef.current?.close();
            }}
            accessibilityRole="button"
            accessibilityLabel="Mark as read"
          >
            <Eye size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.swipeActionText}>Read</Text>
          </TouchableOpacity>
        ) : null,
      [notification.id, isUnread, colors.primary, onMarkRead],
    );

    const renderRightActions = useCallback(
      () => (
        <View style={styles.swipeActionsRight}>
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: colors.warning }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              onArchive(notification.id);
              swipeableRef.current?.close();
            }}
            accessibilityRole="button"
            accessibilityLabel="Archive notification"
          >
            <Archive size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.swipeActionText}>Archive</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: colors.error }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
                () => {},
              );
              onDelete(notification.id);
              swipeableRef.current?.close();
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete notification"
          >
            <Trash2 size={18} color="#fff" strokeWidth={2} />
            <Text style={styles.swipeActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ),
      [notification.id, colors, onArchive, onDelete],
    );

    const card = (
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[
            styles.notificationCard,
            {
              backgroundColor: isUnread
                ? withAlpha(colors.primary, 0.05)
                : colors.card,
              borderLeftWidth: isUrgent ? 3 : 0,
              borderLeftColor: isUrgent ? colors.error : "transparent",
            },
          ]}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${notification.title}. ${notification.body}. ${isUnread ? "Unread" : "Read"}`}
          activeOpacity={0.7}
        >
          <View style={styles.cardRow}>
            {/* Category icon */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withAlpha(categoryColor, 0.12) },
              ]}
            >
              <IconComp size={20} color={categoryColor} strokeWidth={1.8} />
            </View>

            {/* Content */}
            <View style={styles.cardDetails}>
              <View style={styles.cardTitleRow}>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: colors.text,
                      fontWeight: isUnread ? "600" : "500",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                {isUnread && (
                  <View
                    style={[
                      styles.unreadDot,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}
              </View>

              <Text
                style={[styles.cardBody, { color: colors.textMuted }]}
                numberOfLines={2}
              >
                {notification.body}
              </Text>

              <View style={styles.cardFooter}>
                <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                  {formatTimeAgo(notification.createdAt)}
                </Text>
                {notification.category && (
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: withAlpha(categoryColor, 0.1) },
                    ]}
                  >
                    <Text
                      style={[styles.categoryBadgeText, { color: categoryColor }]}
                    >
                      {notification.category}
                    </Text>
                  </View>
                )}
                {isUrgent && (
                  <View
                    style={[
                      styles.urgentBadge,
                      { backgroundColor: withAlpha(colors.error, 0.1) },
                    ]}
                  >
                    <AlertTriangle size={10} color={colors.error} strokeWidth={2} />
                    <Text
                      style={[styles.urgentBadgeText, { color: colors.error }]}
                    >
                      Urgent
                    </Text>
                  </View>
                )}
              </View>

              {notification.actionText && (
                <View style={styles.actionRow}>
                  <Text
                    style={[styles.actionText, { color: colors.primary }]}
                  >
                    {notification.actionText}
                  </Text>
                  <ChevronRight
                    size={14}
                    color={colors.primary}
                    strokeWidth={2}
                  />
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );

    // Animate only first N items
    if (index < MAX_ANIMATED_INDEX) {
      return (
        <Animated.View entering={FadeIn.delay(index * 40).duration(250)}>
          {card}
        </Animated.View>
      );
    }

    return card;
  },
);
NotificationCard.displayName = "NotificationCard";

// ---------------------------------------------------------------------------
// Notification Detail Sheet
// ---------------------------------------------------------------------------

interface DetailSheetProps {
  notification: Notification | undefined;
  colors: ThemeColors;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  bottomInset: number;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

const NotificationDetailSheet = memo<DetailSheetProps>(
  ({
    notification,
    colors,
    bottomSheetRef,
    bottomInset,
    onClose,
    onMarkRead,
    onArchive,
    onDelete,
  }) => {
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    const handleChange = useCallback(
      (idx: number) => {
        if (idx === -1) onClose();
      },
      [onClose],
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={["55%"]}
        enablePanDownToClose
        onChange={handleChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetView
          style={[
            styles.sheetContent,
            { paddingBottom: Math.max(bottomInset, 20) },
          ]}
        >
          {notification ? (
            <NotificationDetailContent
              notification={notification}
              colors={colors}
              onMarkRead={onMarkRead}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
NotificationDetailSheet.displayName = "NotificationDetailSheet";

const NotificationDetailContent = memo<{
  notification: Notification;
  colors: ThemeColors;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}>(({ notification, colors, onMarkRead, onArchive, onDelete }) => {
  const categoryColor = getCategoryColor(notification.category, colors);
  const IconComp = getCategoryIcon(notification.category);

  return (
    <>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <View
          style={[
            styles.sheetIcon,
            { backgroundColor: withAlpha(categoryColor, 0.12) },
          ]}
        >
          <IconComp size={28} color={categoryColor} strokeWidth={1.8} />
        </View>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>
          {notification.title}
        </Text>
        {notification.category && (
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: withAlpha(categoryColor, 0.1) },
            ]}
          >
            <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
              {notification.category}
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      <Text style={[styles.sheetBody, { color: colors.text }]}>
        {notification.body}
      </Text>

      {/* Meta rows */}
      <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>
          Time
        </Text>
        <Text style={[styles.sheetRowValue, { color: colors.text }]}>
          {formatTimeAgo(notification.createdAt)}
        </Text>
      </View>

      <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>
          Priority
        </Text>
        <Text
          style={[
            styles.sheetRowValue,
            {
              color:
                notification.priority === "URGENT"
                  ? colors.error
                  : notification.priority === "HIGH"
                    ? colors.warning
                    : colors.text,
            },
          ]}
        >
          {notification.priority?.charAt(0) +
            notification.priority?.slice(1).toLowerCase()}
        </Text>
      </View>

      <View style={[styles.sheetRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sheetRowLabel, { color: colors.textMuted }]}>
          Status
        </Text>
        <Text style={[styles.sheetRowValue, { color: colors.text }]}>
          {notification.read ? "Read" : "Unread"}
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.sheetActions}>
        {notification.actionUrl && (
          <TouchableOpacity
            style={[styles.sheetActionBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (notification.actionUrl!.startsWith("http")) {
                Linking.openURL(notification.actionUrl!).catch(() => {});
              } else {
                router.push(notification.actionUrl as Href);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetActionBtnText}>
              {notification.actionText || "View"}
            </Text>
            <ChevronRight size={16} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        )}

        {!notification.read && (
          <TouchableOpacity
            style={[
              styles.sheetActionBtnOutline,
              { borderColor: colors.primary },
            ]}
            onPress={() => onMarkRead(notification.id)}
            activeOpacity={0.7}
          >
            <Eye size={16} color={colors.primary} strokeWidth={2} />
            <Text
              style={[styles.sheetActionBtnOutlineText, { color: colors.primary }]}
            >
              Mark Read
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.sheetActionBtnOutline,
            { borderColor: colors.warning },
          ]}
          onPress={() => onArchive(notification.id)}
          activeOpacity={0.7}
        >
          <Archive size={16} color={colors.warning} strokeWidth={2} />
          <Text
            style={[styles.sheetActionBtnOutlineText, { color: colors.warning }]}
          >
            Archive
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sheetActionBtnOutline,
            { borderColor: colors.error },
          ]}
          onPress={() => onDelete(notification.id)}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={colors.error} strokeWidth={2} />
          <Text
            style={[styles.sheetActionBtnOutlineText, { color: colors.error }]}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
});
NotificationDetailContent.displayName = "NotificationDetailContent";

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle } = useStatusBar();
  const { markNotificationsSeen } = usePushNotifications();

  // Zustand persisted filter (stable exported selectors)
  const selectedFilter = useNotificationUIStore(selectNotificationFilter);
  const setSelectedFilter = useNotificationUIStore(selectSetNotificationFilter);
  const selectedNotifId = useNotificationUIStore(selectSelectedNotificationId);
  const openDetail = useNotificationUIStore(selectOpenNotificationDetail);
  const closeDetail = useNotificationUIStore(selectCloseNotificationDetail);

  // Data hooks
  const {
    flatData,
    summary: pageSummary,
    activeTotal,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    data: queryData,
  } = useFlatNotifications({ type: selectedFilter });

  const {
    data: statsData,
    isLoading: isStatsLoading,
  } = useNotificationStats();

  // Mutations
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const { mutate: archiveNotification } = useArchiveNotification();

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mark notifications seen on focus
  useFocusEffect(
    useCallback(() => {
      markNotificationsSeen();
    }, [markNotificationsSeen]),
  );

  // Find selected notification for detail sheet
  const selectedNotification: Notification | undefined = useMemo(() => {
    if (!selectedNotifId || !queryData?.pages) return undefined;
    for (const page of queryData.pages) {
      const found = page.notifications.find((n) => n.id === selectedNotifId);
      if (found) return found;
    }
    return undefined;
  }, [selectedNotifId, queryData?.pages]);

  // Stats for summary card — prefer dedicated stats, fall back to page summary
  const summaryStats = useMemo(() => {
    if (statsData) {
      return {
        total: statsData.total,
        unread: statsData.unread,
        categories: statsData.categories,
        priorities: statsData.priorities,
      };
    }
    if (pageSummary) {
      return {
        total: activeTotal,
        unread: pageSummary.unreadCount,
        categories: pageSummary.categoryCounts,
      };
    }
    return undefined;
  }, [statsData, pageSummary, activeTotal]);

  // Build filter count map from stats for all filter chips
  const filterCounts = useMemo((): Record<NotificationFilterType, number> => {
    const cats = summaryStats?.categories ?? {};
    return {
      all: summaryStats?.total ?? 0,
      unread: summaryStats?.unread ?? 0,
      payments: cats.payments ?? 0,
      rewards: cats.rewards ?? 0,
      surveys: cats.surveys ?? 0,
      security: cats.security ?? 0,
      subscription: cats.subscription ?? 0,
      achievements: cats.achievements ?? 0,
    };
  }, [summaryStats]);

  // Handlers (ID-based — no inline closures)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleNotificationPress = useCallback(
    (id: string) => {
      openDetail(id);
      requestAnimationFrame(() => {
        bottomSheetRef.current?.snapToIndex(0);
      });
    },
    [openDetail],
  );

  const handleCloseDetail = useCallback(() => {
    closeDetail();
  }, [closeDetail]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markRead(id);
    },
    [markRead],
  );

  const handleArchive = useCallback(
    (id: string) => {
      archiveNotification(id);
    },
    [archiveNotification],
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        "Delete Notification",
        "Are you sure you want to delete this notification?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteNotification(id),
          },
        ],
      );
    },
    [deleteNotification],
  );

  const handleMarkAllRead = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      "Mark All as Read",
      "Mark all notifications as read?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All Read",
          onPress: () => {
            markAllRead(undefined);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ).catch(() => {});
          },
        },
      ],
    );
  }, [markAllRead]);

  const handleFilterPress = useCallback(
    (filterId: NotificationFilterType) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSelectedFilter(filterId);
    },
    [setSelectedFilter],
  );

  // Render item
  const renderItem = useCallback(
    ({ item, index }: { item: NotificationFlatListItem; index: number }) => {
      if (item.type === "section") {
        return <SectionHeader title={item.title} colors={colors} />;
      }
      return (
        <NotificationCard
          notification={item.data}
          colors={colors}
          index={index}
          onPress={handleNotificationPress}
          onMarkRead={handleMarkRead}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      );
    },
    [colors, handleNotificationPress, handleMarkRead, handleArchive, handleDelete],
  );

  const keyExtractor = useCallback(
    (item: NotificationFlatListItem) => item.key,
    [],
  );

  // Unread count for header badge
  const unreadCount = summaryStats?.unread ?? 0;

  // List header
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Screen Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Notifications
              </Text>
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.headerBadge,
                    { backgroundColor: colors.error },
                  ]}
                >
                  <Text style={styles.headerBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                : "All caught up"}
            </Text>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={[styles.markAllButton, { borderColor: colors.border }]}
              onPress={handleMarkAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              activeOpacity={0.7}
            >
              <CheckCheck size={18} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Summary Card */}
        <NotificationSummaryCard
          stats={summaryStats}
          colors={colors}
          isLoading={isStatsLoading && !summaryStats}
        />

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              filterId={f.id}
              label={f.label}
              count={filterCounts[f.id] ?? 0}
              isActive={selectedFilter === f.id}
              colors={colors}
              onFilterPress={handleFilterPress}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [
      colors,
      unreadCount,
      summaryStats,
      isStatsLoading,
      filterCounts,
      selectedFilter,
      handleFilterPress,
      handleMarkAllRead,
    ],
  );

  // Empty state
  const ListEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <NotificationCardSkeleton key={`skel_${i}`} colors={colors} />
          ))}
        </View>
      );
    }

    const { Icon, title, subtitle } = getEmptyState(selectedFilter);
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.emptyState, { backgroundColor: colors.card }]}
      >
        <Icon size={48} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </Animated.View>
    );
  }, [isLoading, selectedFilter, colors]);

  // Footer (infinite scroll indicator)
  const ListFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, colors.primary]);

  // Stable contentContainerStyle
  const contentContainerStyle = useMemo(
    () => ({
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 80,
      paddingHorizontal: 16,
      flexGrow: 1,
    }),
    [insets.top, insets.bottom],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} animated />

      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />

      {/* Bottom Sheet Detail */}
      <NotificationDetailSheet
        notification={selectedNotification}
        colors={colors}
        bottomSheetRef={bottomSheetRef}
        bottomInset={insets.bottom}
        onClose={handleCloseDetail}
        onMarkRead={handleMarkRead}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  headerBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  markAllButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Summary card
  summaryCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: { alignItems: "center" },
  summaryNumber: { fontSize: 22, fontWeight: "700" },
  summaryLabel: { fontSize: 11, marginTop: 2, textTransform: "uppercase" },
  summarySeparator: { width: 1, height: 36 },

  // Filters
  filterContainer: { marginBottom: 8, marginHorizontal: -16 },
  filterContent: { gap: 8, paddingVertical: 4, paddingHorizontal: 16 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  chipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBadgeText: { fontSize: 11, fontWeight: "600" },

  // Section header
  sectionHeader: { paddingTop: 16, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },

  // Notification card
  notificationCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardDetails: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, flex: 1, marginRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardBody: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  cardTime: { fontSize: 12 },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  urgentBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  urgentBadgeText: { fontSize: 10, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  actionText: { fontSize: 13, fontWeight: "500" },

  // Swipe actions
  swipeAction: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginLeft: 4,
    gap: 4,
  },
  swipeActionsRight: { flexDirection: "row", marginBottom: 8 },
  swipeActionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },

  // Bottom sheet
  sheetContent: { paddingHorizontal: 20, paddingTop: 8 },
  sheetHeader: { alignItems: "center", marginBottom: 16, gap: 8 },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  sheetBody: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetRowLabel: { fontSize: 14 },
  sheetRowValue: { fontSize: 14, fontWeight: "500" },
  sheetActions: { marginTop: 16, gap: 10 },
  sheetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  sheetActionBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  sheetActionBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  sheetActionBtnOutlineText: { fontSize: 14, fontWeight: "500" },

  // Empty state
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
    marginTop: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // Footer
  footerLoader: { paddingVertical: 20, alignItems: "center" },

  // Skeleton
  skeletonIcon: { width: 40, height: 40, borderRadius: 20 },
  skeletonTitle: { width: "60%", height: 14, borderRadius: 6 },
  skeletonMeta: { width: "40%", height: 10, borderRadius: 4, marginTop: 6 },
  skeletonAmount: { width: 70, height: 18, borderRadius: 6 },
});
