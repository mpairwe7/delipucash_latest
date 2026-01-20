import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/utils/theme";

/**
 * Auth layout component
 * Wraps authentication screens with proper navigation configuration
 */
export default function AuthLayout(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
