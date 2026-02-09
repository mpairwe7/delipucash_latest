import React, { memo, useCallback } from "react";
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  Pressable,
  View,
  ViewStyle,
} from "react-native";
import { Bell } from "lucide-react-native";
import { useTheme, RADIUS, SPACING, TYPOGRAPHY } from "@/utils/theme";
import { usePushNotifications } from "@/utils/usePushNotifications";
import { triggerHaptic } from "@/utils/quiz-utils";

export interface NotificationBellProps {
  count?: number;
  onPress?: (event: GestureResponderEvent) => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

function NotificationBellComponent({
  count = 0,
  onPress,
  style,
  accessibilityLabel = "Open notifications",
}: NotificationBellProps): React.ReactElement {
  const { colors } = useTheme();
  const { hasNewNotification, markNotificationsSeen } = usePushNotifications();

  const displayCount = count > 9 ? "9+" : count > 0 ? String(count) : undefined;
  const showIndicator = Boolean(displayCount) || hasNewNotification;

  const handlePress = useCallback((event: GestureResponderEvent): void => {
    triggerHaptic('light');
    markNotificationsSeen();
    onPress?.(event);
  }, [markNotificationsSeen, onPress]);

  return (
    <Pressable
      style={[
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap to view your notifications"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Bell size={22} color={colors.text} strokeWidth={1.5} />
      {showIndicator && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.error,
              minWidth: displayCount ? 18 : 10,
              height: displayCount ? 18 : 10,
            },
          ]}
        >
          {displayCount && <Text style={styles.badgeText}>{displayCount}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: SPACING.xs,
    right: SPACING.xs,
    borderRadius: RADIUS.full,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    lineHeight: 12,
  },
});

export const NotificationBell = memo(NotificationBellComponent);
NotificationBell.displayName = 'NotificationBell';
