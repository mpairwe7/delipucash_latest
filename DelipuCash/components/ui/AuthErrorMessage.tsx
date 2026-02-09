/**
 * AuthErrorMessage Component
 * Shared error message banner for auth screens.
 * Extracted to eliminate duplication across login, signup,
 * forgot-password, and reset-password screens.
 *
 * @example
 * ```tsx
 * {generalError ? (
 *   <AuthErrorMessage message={generalError} />
 * ) : null}
 * ```
 */

import React, { memo, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
} from "@/utils/theme";

export interface AuthErrorMessageProps {
  /** Error message text */
  message: string;
  /** Whether to show an icon (e.g. for reset-password) */
  icon?: React.ReactNode;
}

export const AuthErrorMessage = memo<AuthErrorMessageProps>(
  ({ message, icon }) => {
    const { colors } = useTheme();

    // Trigger haptic feedback when error appears (2026 tactile feedback standard)
    useEffect(() => {
      if (message && Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }, [message]);

    return (
      <View
        style={[
          styles.container,
          icon ? styles.containerWithIcon : undefined,
          {
            backgroundColor: `${colors.error}15`,
            borderColor: `${colors.error}30`,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {icon && icon}
        <Text
          style={[
            styles.text,
            icon ? styles.textWithIcon : undefined,
            { color: colors.error },
          ]}
        >
          {message}
        </Text>
      </View>
    );
  }
);

AuthErrorMessage.displayName = "AuthErrorMessage";

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.lg,
    borderWidth: BORDER_WIDTH.thin,
  },
  containerWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  textWithIcon: {
    flex: 1,
    textAlign: "left",
  },
});

export default AuthErrorMessage;
