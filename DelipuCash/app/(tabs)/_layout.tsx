import {
  useTheme
} from "@/utils/theme";
import { Tabs } from "expo-router";
import {
  BarChart2,
  Home,
  LucideIcon,
  MessageSquare,
  User,
  Video,
} from "lucide-react-native";
import React, { useEffect } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";

interface TabIconProps {
  Icon: LucideIcon;
  focused: boolean;
  color: string;
}

const TabIcon: React.FC<TabIconProps> = ({ Icon, focused, color }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
    <Icon size={24} color={color} strokeWidth={focused ? 2 : 1.5} />
  </View>
);

interface TabConfig {
  name: string;
  title: string;
  icon: LucideIcon;
}

const tabs: TabConfig[] = [
  { name: "home", title: "Home", icon: Home },
  { name: "questions", title: "Questions", icon: MessageSquare },
  { name: "videos-new", title: "Videos", icon: Video },
  { name: "surveys", title: "Surveys", icon: BarChart2 },
  { name: "profile", title: "Profile", icon: User },
];

/**
 * Tab layout component
 * Manages bottom tab navigation for the main app screens
 */
export default function TabLayout(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Lock to portrait for main tab navigation
  // Individual screens can unlock for specific features (video player, camera, etc.)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch((err) => console.warn('Failed to lock portrait in tabs:', err));
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
          height: 60 + (insets.bottom || 8),
        },
        tabBarLabelStyle: {
          fontFamily: "Roboto_500Medium",
          fontSize: 12,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <TabIcon Icon={tab.icon} focused={focused} color={color} />
            ),
          }}
        />
      ))}
      <Tabs.Screen
        name="transactions"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="withdraw"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerFocused: {
    transform: [{ scale: 1.05 }],
  },
});
