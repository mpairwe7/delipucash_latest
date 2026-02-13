import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { Platform, View, ErrorUtils } from 'react-native';
import 'react-native-reanimated';
// expo-keep-awake disabled due to New Architecture incompatibility in Expo Go
// import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';

import { NotificationProvider } from '@/utils/usePushNotifications';
import { ToastProvider } from '@/components/ui/Toast';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/utils/auth/useAuth';
import { purchasesService } from '@/services/purchasesService';
import { SSEProvider } from '@/providers/SSEProvider';
import { AdFrequencyManager } from '@/services/adFrequencyManager';

// Prevent the splash screen from auto-hiding before asset loading is complete.
// This is called at module level to ensure it runs before any rendering.
SplashScreen.preventAutoHideAsync();

// Global error handler for keep-awake issues in Expo Go with New Architecture
if (Platform.OS !== 'web') {
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.warn = (...args) => {
    // Filter out LayoutAnimation warnings in New Architecture
    const warningMessage = args.join(' ');
    if (warningMessage.includes('setLayoutAnimationEnabledExperimental') ||
        warningMessage.includes('New Architecture')) {
      return; // Suppress these warnings
    }
    originalConsoleWarn.apply(console, args);
  };

  console.error = (...args) => {
    // Filter out keep-awake related errors in Expo Go
    const errorMessage = args.join(' ');
    if (errorMessage.includes('keep awake') || errorMessage.includes('activateKeepAwake')) {
      console.warn('[Expo Go] Keep-awake functionality disabled due to New Architecture compatibility');
      return;
    }
    originalConsoleError.apply(console, args);
  };

  // Handle unhandled promise rejections using ErrorUtils (React Native compatible)
  // ErrorUtils may not be available in all environments
  if (typeof ErrorUtils !== 'undefined' && ErrorUtils?.getGlobalHandler) {
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      if (error && typeof error === 'object' && 'message' in error) {
        if ((error.message as string).includes('keep awake')) {
          console.warn('[Expo Go] Keep-awake error caught and ignored');
          return; // Don't call the original handler for keep-awake errors
        }
      }
      // Call original handler for other errors
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });
  }
}

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

// Create QueryClient at module level to avoid timing issues with expo-router
// This ensures the QueryClient is always available when components mount
const queryClient = new QueryClient({
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

  // Initialize Ad Frequency Manager (loads persisted caps/session from AsyncStorage)
  useEffect(() => {
    AdFrequencyManager.initialize().catch((err) =>
      console.warn('Failed to initialize AdFrequencyManager:', err)
    );
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
        <SSEProvider>
        <NotificationProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <ToastProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="reward-question/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-questions" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-answer/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="question-answer/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              {/* Profile destination screens — headerShown: false to avoid double headers
                  (each screen renders its own custom header with back navigation) */}
              <Stack.Screen name="help-support" options={{ headerShown: false }} />
              <Stack.Screen name="ad-registration" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-upload" options={{ headerShown: false }} />
              <Stack.Screen name="file-upload" options={{ headerShown: false }} />
              <Stack.Screen name="create-survey" options={{ headerShown: false }} />
              <Stack.Screen name="survey-payment" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
            </ToastProvider>
          </ThemeProvider>
        </NotificationProvider>
        </SSEProvider>
      </QueryClientProvider>
    </View>
  );
}
