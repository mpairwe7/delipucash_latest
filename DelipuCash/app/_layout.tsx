import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { SplashScreen, Stack, usePathname } from 'expo-router';
import { StatusBar, setStatusBarHidden, setStatusBarStyle, setStatusBarTranslucent } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect, useMemo } from 'react';
import { AppState, LogBox, Platform, ErrorUtils, StyleSheet } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
// expo-keep-awake disabled due to New Architecture incompatibility in Expo Go
// import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
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

import { useAuthStore, initializeAuth } from '@/utils/auth/store';
import { useThemeStore, SYSTEM_BARS } from '@/utils/theme';
import { purchasesService } from '@/services/purchasesService';
import { SSEProvider } from '@/providers/SSEProvider';
import { AdFrequencyManager } from '@/services/adFrequencyManager';
import { useOfflineQueueProcessor } from '@/hooks/useOfflineQueueProcessor';
import { useUploadQueueProcessor } from '@/hooks/useUploadQueueProcessor';
import { telemetry } from '@/services/telemetryApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/**
 * Root-level system bars policy (2026 best-practice, inspired by
 * Instagram, TikTok, YouTube, Threads & X):
 *
 * 1. Edge-to-edge on Android AND iOS — content flows under system bars.
 * 2. Translucent status bar with theme-aware icon color.
 * 3. Transparent Android gesture navigation bar via expo-navigation-bar.
 * 4. Subtle scrim gradients overlaying the status bar / bottom area so
 *    white status-bar icons stay legible against any background in dark
 *    mode, and dark icons stay legible in light mode.
 * 5. Immersive route detection: video routes auto-hide system bars.
 * 6. This is the *baseline*; individual screens can override via the
 *    focus-aware `useStatusBar()` hook when they need a different style.
 */
function GlobalSystemBars({ isDark }: { isDark: boolean }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Full-bleed media routes opt into immersive (hidden) system bars.
  const isImmersiveRoute = useMemo(
    () => pathname.startsWith('/video/'),
    [pathname]
  );

  // --------------------------------------------------------------------------
  // Tab routes already have solid-colored backgrounds and their own safe-area
  // padding — scrims are unnecessary and in dark mode they create an overly
  // dark band at the top that overshadows the status bar / content area.
  // Only render scrims on non-tab standalone screens where content may scroll
  // edge-to-edge under the status bar (e.g. question detail, reward screens).
  // --------------------------------------------------------------------------
  const TAB_ROUTES = [
    '/home-redesigned',
    '/questions-new',
    '/videos-new',
    '/surveys-new',
    '/profile-new',
    '/transactions',
    '/withdraw',
    '/explore',
  ];

  const isTabRoute = useMemo(
    () => TAB_ROUTES.some((route) => pathname === route || pathname === `/(tabs)${route}`),
    [pathname]
  );

  // --------------------------------------------------------------------------
  // Scrim colors — subtle gradient overlays that keep system bar icons
  // readable regardless of the content scrolling behind them.
  //
  // Dark mode: a gentle dark-to-transparent scrim (Instagram / TikTok style)
  //            prevents white status-bar icons from disappearing on bright
  //            content cards. Reduced opacity to avoid overshadowing content.
  // Light mode: a very subtle white-to-transparent scrim keeps dark icons
  //             legible on dark hero images.
  // --------------------------------------------------------------------------
  const topScrimColors: [string, string] = isDark
    ? ['rgba(0, 0, 0, 0.25)', 'transparent']
    : ['rgba(255, 255, 255, 0.25)', 'transparent'];

  const bottomScrimColors: [string, string] = isDark
    ? ['transparent', 'rgba(0, 0, 0, 0.18)']
    : ['transparent', 'rgba(255, 255, 255, 0.15)'];

  // Whether scrims should be rendered:
  // - Not on immersive routes (system bars are hidden)
  // - Not on tab routes (they handle their own backgrounds & safe areas)
  const showScrims = !isImmersiveRoute && !isTabRoute;

  // --------------------------------------------------------------------------
  // Apply system bar configuration imperatively (covers cases where the
  // declarative <StatusBar> component might lag behind theme changes).
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Status bar icon color: light (white) in dark mode, dark (black) in light
    setStatusBarStyle(isDark ? 'light' : 'dark', true);
    setStatusBarHidden(isImmersiveRoute, 'fade');

    if (Platform.OS === 'android') {
      // Edge-to-edge status bar
      setStatusBarTranslucent(true);

      // Note: setBackgroundColorAsync / setPositionAsync removed — handled
      // natively by edgeToEdgeEnabled: true in app.json (Expo SDK 54+).
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});

      // Immersive routes also hide the navigation bar
      if (isImmersiveRoute) {
        NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      } else {
        NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    }
  }, [isDark, isImmersiveRoute]);

  return (
    <>
      {/* Declarative StatusBar component — authoritative baseline for the app */}
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        translucent
        hidden={isImmersiveRoute}
        animated
      />

      {showScrims && (
        <>
          {/* Top scrim: protects status bar icons from being swallowed by
              bright/dark content scrolling underneath */}
          <LinearGradient
            pointerEvents="none"
            colors={topScrimColors}
            style={[
              styles.systemBarTopScrim,
              { height: insets.top + 14 },
            ]}
          />
          {/* Bottom scrim: protects home indicator / gesture bar area */}
          <LinearGradient
            pointerEvents="none"
            colors={bottomScrimColors}
            style={[
              styles.systemBarBottomScrim,
              { height: Math.max(insets.bottom + 12, SYSTEM_BARS.navigationBar.gestureHeight + 8) },
            ]}
          />
        </>
      )}
    </>
  );
}

export default function RootLayout() {
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

  // Read auth state for RevenueCat user sync
  const auth = useAuthStore(s => s.auth);

  // Initialize RevenueCat Purchases SDK
  useEffect(() => {
    if (Platform.OS !== 'web') {
      purchasesService.initialize().catch((err) =>
        console.warn('Failed to initialize RevenueCat:', err)
      );
    }
  }, []);

  // Sync RevenueCat user identity when auth state changes
  // Login identifies user for cross-device subscription sync
  // Logout resets to anonymous user
  useEffect(() => {
    if (Platform.OS === 'web' || !purchasesService.isReady()) return;

    if (auth?.user?.id) {
      purchasesService.login(auth.user.id).catch((err) =>
        console.warn('Failed to identify RevenueCat user:', err)
      );
    } else {
      purchasesService.logout().catch((err) =>
        console.warn('Failed to logout RevenueCat user:', err)
      );
    }
  }, [auth?.user?.id]);

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
            <GlobalSystemBars isDark={isDark} />
            </ToastProvider>
          </ThemeProvider>
        </NotificationProvider>
        </SSEProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  systemBarTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
  },
  systemBarBottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
});
