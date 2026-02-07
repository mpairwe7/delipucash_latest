import React, { useCallback, useMemo, memo } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, BellRing, CheckCircle2 } from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import * as Linking from "expo-linking";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from "@/utils/theme";
import {
  useNotifications,
  useMarkNotificationRead,
} from "@/services/hooks";
import { Notification } from "@/types";
import { usePushNotifications } from "@/utils/usePushNotifications";

export default function NotificationsScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { data, refetch, isFetching } = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { markNotificationsSeen } = usePushNotifications();

  const notifications = useMemo(() => data ?? [], [data]);
  const refreshing = isFetching;

  useFocusEffect(
    useCallback(() => {
      markNotificationsSeen();
    }, [markNotificationsSeen]),
  );

  const handleMarkRead = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        markRead(notification.id);
      }
      if (notification.actionUrl) {
        if (notification.actionUrl.startsWith("http")) {
          Linking.openURL(notification.actionUrl);
        } else {
          router.push(notification.actionUrl as Href);
        }
      }
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: item.read
              ? colors.card
              : withAlpha(colors.primary, 0.08),
            borderColor: item.read
              ? colors.border
              : withAlpha(colors.primary, 0.25),
          },
        ]}
        onPress={() => handleMarkRead(item)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: withAlpha(colors.primary, 0.12) },
            ]}
          >
            <BellRing size={18} color={colors.primary} strokeWidth={1.6} />
          </View>
          <View style={styles.meta}>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.timestamp, { color: colors.textMuted }]}>
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Text>
          </View>
          {item.read ? (
            <CheckCircle2 size={18} color={colors.success} strokeWidth={1.5} />
          ) : null}
        </View>
        {item.body ? (
          <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>
        ) : null}
        {item.actionText ? (
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {item.actionText}
          </Text>
        ) : null}
      </TouchableOpacity>
    ),
    [colors, handleMarkRead],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const emptyComponent = useMemo(
    () => (
      <View style={[styles.emptyState, { borderColor: colors.border }]}>
        <BellRing size={28} color={colors.textMuted} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Stay tuned — updates from surveys, rewards, and payments will appear here.
        </Text>
      </View>
    ),
    [colors],
  );

  const onRefresh = useCallback(() => {
    markNotificationsSeen();
    refetch();
  }, [markNotificationsSeen, refetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.base,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={notifications}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: insets.bottom + SPACING.xl,
          },
        ]}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={emptyComponent}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={7}
        initialNumToRender={6}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  listContent: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.sm,
  },
  meta: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  timestamp: {
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  body: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 20,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    lineHeight: 20,
  },
});
