import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, LogBox, Platform, ErrorUtils } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
// expo-keep-awake disabled due to New Architecture incompatibility in Expo Go
// import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFonts } from 'expo-font';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';

import { NotificationProvider } from '@/utils/usePushNotifications';
import { ToastProvider } from '@/components/ui/Toast';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, initializeAuth } from '@/utils/auth/store';
import { useThemeStore } from '@/utils/theme';
import { purchasesService } from '@/services/purchasesService';
import { SSEProvider } from '@/providers/SSEProvider';
import { AdFrequencyManager } from '@/services/adFrequencyManager';
import { useOfflineQueueProcessor } from '@/hooks/useOfflineQueueProcessor';
import { useUploadQueueProcessor } from '@/hooks/useUploadQueueProcessor';
import { telemetry } from '@/services/telemetryApi';

// Suppress Reanimated false-positive warning (all .value reads are inside useAnimatedStyle)
LogBox.ignoreLogs(['Reading from `value` during component render']);

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
        const msg = error.message as string;
        if (msg.includes('keep awake')) {
          console.warn('[Expo Go] Keep-awake error caught and ignored');
          return;
        }
        // Suppress ExpoAsset download failures (fonts/icons over flaky dev network)
        if (msg.includes('ExpoAsset.downloadAsync') || msg.includes('unable to download asset')) {
          console.warn('[ExpoAsset] Asset download failed — using fallback:', msg.slice(0, 120));
          return;
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

// Wire TanStack Query focusManager to AppState so stale queries
// automatically refetch when the app returns from background.
// This ensures user profile data is fresh after resume.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      handleFocus(status === 'active');
    });
    return () => subscription.remove();
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
      // gcTime must be ≥ persister maxAge so cached data survives to be restored.
      // 24 hours: Instagram/TikTok-style "instant open" even after hours away.
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      // Refetch settings — refetch stale queries when app returns to foreground
      refetchOnWindowFocus: true,
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

// AsyncStorage persister — survives cold restarts.
// On next app open the cache is restored BEFORE any network request,
// giving every screen instant data (stale-while-revalidate).
// Throttle writes to 2 s to avoid excessive I/O during rapid cache updates.
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 2000,
});

/** Invisible component that runs global background tasks inside the provider tree */
function GlobalProcessors() {
  useOfflineQueueProcessor();
  useUploadQueueProcessor();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Read isReady directly from Zustand — no TanStack dependency
  const isReady = useAuthStore(s => s.isReady);
  // Get theme state from custom theme store for StatusBar
  const isDark = useThemeStore(s => s.isDark);

  // Preload Roboto fonts + vector icon font families so they're available
  // before any component renders. Prevents ExpoAsset.downloadAsync rejections
  // by loading everything up-front while the splash screen is still visible.
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...MaterialIcons.font,
    ...Feather.font,
  });

  // Log font loading errors but don't block the app — system fonts are the fallback
  useEffect(() => {
    if (fontError) {
      console.warn('[Fonts] Failed to load custom fonts, using system fallback:', fontError.message);
    }
  }, [fontError]);

  // Initialize auth state from SecureStore on app start
  // Uses standalone initializeAuth() — no QueryClient needed
  useEffect(() => {
    initializeAuth();
  }, []);

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

  // Initialize telemetry session (batch event buffer for video feed)
  useEffect(() => {
    telemetry.init();
    return () => telemetry.destroy();
  }, []);

  // Set default orientation to portrait on app start
  useEffect(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch((err) => console.warn('Failed to set initial orientation:', err));
    }
  }, []);

  // Hide native splash after BOTH auth state AND fonts are ready.
  // This prevents flash-of-unstyled-text and ExpoAsset download errors
  // by keeping the splash visible until all assets are available.
  useEffect(() => {
    if (isReady && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <SSEProvider>
        <NotificationProvider>
          <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <ToastProvider>
            <GlobalProcessors />
            <Stack screenOptions={{ contentStyle: { backgroundColor: isDark ? '#000000' : '#FFFFFF' } }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="reward-question/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="reward-questions" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-questions" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-answer/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="question-answer/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              {/* Profile destination screens — headerShown: false to avoid double headers
                  (each screen renders its own custom header with back navigation) */}
              <Stack.Screen name="help-support" options={{ headerShown: false }} />
              <Stack.Screen name="ad-registration" options={{ headerShown: false }} />
              <Stack.Screen name="instant-reward-upload" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="file-upload" options={{ headerShown: false }} />
              <Stack.Screen name="create-survey" options={{ headerShown: false }} />
              <Stack.Screen name="survey-payment" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
              <Stack.Screen name="video/[id]" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} translucent animated />
            </ToastProvider>
          </ThemeProvider>
        </NotificationProvider>
        </SSEProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
