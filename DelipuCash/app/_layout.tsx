import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import NotificationProvider from '@/utils/usePushNotifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/utils/auth/useAuth';

// Prevent the splash screen from auto-hiding before asset loading is complete.
// This is called at module level to ensure it runs before any rendering.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const queryClient = useRef(new QueryClient()).current;
  const colorScheme = useColorScheme();
  const { initiate, isReady } = useAuth();

  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  // Initialize auth state from SecureStore on app start
  useEffect(() => {
    initiate();
  }, [initiate]);

  // Callback-based approach for hiding splash screen (recommended)
  const onLayoutRootView = useCallback(async () => {
    if ((fontsLoaded || fontError) && isReady) {
      // Hide splash screen after the root view has performed layout
      // and auth state has been initialized
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isReady]);

  // Log font errors in development for debugging
  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontError]);

  // Keep showing splash screen while fonts load or auth initializes
  // Return a minimal view instead of null to prevent white flash
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </View>
  );
}
