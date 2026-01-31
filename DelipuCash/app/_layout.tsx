import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';
// expo-keep-awake disabled due to New Architecture incompatibility in Expo Go
// import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';

import { NotificationProvider } from '@/utils/usePushNotifications';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/utils/auth/useAuth';
import { purchasesService } from '@/services/purchasesService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
// This is called at module level to ensure it runs before any rendering.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

// Configure online manager for network awareness
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
  });
}

// Create QueryClient with retry and caching configuration for network resilience
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      // Retry configuration for network resilience
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Stale time defaults
      staleTime: 1000 * 60 * 2, // 2 minutes
      // Cache time (garbage collection)
      gcTime: 1000 * 60 * 30, // 30 minutes
      // Refetch settings
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Network mode - fetch when online, use cache when offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Retry mutations up to 2 times for failed network requests
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Network mode for mutations
      networkMode: 'offlineFirst',
    },
  },
});

export default function RootLayout() {
  const queryClient = useRef(createQueryClient()).current;
  const colorScheme = useColorScheme();
  const { initiate, isReady } = useAuth();

  // Initialize auth state from SecureStore on app start
  useEffect(() => {
    initiate();
  }, [initiate]);

  // Initialize RevenueCat Purchases SDK
  useEffect(() => {
    if (Platform.OS !== 'web') {
      purchasesService.initialize().catch((err) =>
        console.warn('Failed to initialize RevenueCat:', err)
      );
    }
  }, []);

  // Set default orientation to portrait on app start
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch((err) => console.warn('Failed to set initial orientation:', err));
    }
  }, []);

  // Keep-awake functionality disabled due to New Architecture incompatibility in Expo Go
  // Re-enable when building standalone apps or when expo-keep-awake is updated
  // useEffect(() => {
  //   if (__DEV__ && Platform.OS !== 'web') {
  //     // Keep screen awake during development
  //   }
  // }, []);

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
