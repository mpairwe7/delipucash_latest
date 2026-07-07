/**
 * App-wide TanStack Query v5 setup — single source of truth for the
 * QueryClient, offline persistence, and React Native environment wiring.
 *
 * Everything here is deliberately module-level: importing this file (done
 * once by app/_layout.tsx) configures the client before any screen renders,
 * which is required because expo-router mounts routes eagerly.
 *
 * Responsibilities:
 * - QueryClient with network-resilient defaults (retry/backoff, offlineFirst)
 * - AsyncStorage persister so the cache survives cold starts
 *   (stale-while-revalidate: screens render cached data instantly)
 * - onlineManager ← NetInfo: pauses/resumes fetching with connectivity
 * - focusManager ← AppState: stale queries refetch when the app foregrounds
 * - Auth-transition safety net: clears cache on passive logout
 */

import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { useAuthStore } from '@/utils/auth/store';

/** AsyncStorage key holding the persisted query cache. */
export const QUERY_PERSIST_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/**
 * How long persisted cache entries remain restorable (24 h).
 * Must be ≤ the client's gcTime so restored data isn't immediately collected.
 */
export const QUERY_PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry configuration for network resilience
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Stale time defaults
      staleTime: 1000 * 60 * 2, // 2 minutes
      // gcTime must be ≥ persister maxAge so cached data survives to be restored.
      // 24 hours: Instagram/TikTok-style "instant open" even after hours away.
      gcTime: QUERY_PERSIST_MAX_AGE,
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
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_PERSIST_KEY,
  throttleTime: 2000,
});

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

// ============================================================================
// Auth transition watcher — clears query cache on passive auth clear
// ============================================================================
// When auth transitions from authenticated → null via passive paths (403
// response, failed refresh), the query cache MUST be cleared to prevent the
// previous user's data from leaking if a different user logs in.
// This runs at module level (outside React) because passive auth clears
// can happen from any service (tokenRefresh.ts, api.ts fetchJson 403).
// The explicit signOut() in useAuth.ts already calls queryClient.clear(),
// but these passive paths don't — this is the centralized safety net.
// (2026 best-practice: Instagram, Threads, X all use centralized auth
// transition observers to ensure cache/state isolation between users.)
let previousAuthState: boolean = false; // tracks "was authenticated"
useAuthStore.subscribe((state) => {
  const isNowAuthenticated = !!state.auth;
  if (previousAuthState && !isNowAuthenticated) {
    // Auth transitioned from non-null → null (passive logout)
    queryClient.clear();
    // Also clear the persisted offline cache so stale user data
    // doesn't rehydrate for a different user on next cold start.
    AsyncStorage.removeItem(QUERY_PERSIST_KEY).catch(() => {});
  }
  previousAuthState = isNowAuthenticated;
});
