import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

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

  // Initialize auth state from SecureStore on app start
  useEffect(() => {
    initiate();
  }, [initiate]);

  // Keep the screen awake in development; swallow errors on unsupported platforms
  useEffect(() => {
    if (__DEV__ && Platform.OS !== 'web') {
      activateKeepAwakeAsync().catch((err) => console.warn('Keep awake unavailable:', err));

      return () => {
        deactivateKeepAwake().catch(() => undefined);
      };
    }
  }, []);

  // Callback-based approach for hiding splash screen (recommended)
  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      // Hide splash screen after the root view has performed layout
      // and auth state has been initialized
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Keep showing splash screen while fonts load or auth initializes
  // Return a minimal view instead of null to prevent white flash
  if (!isReady) {
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
