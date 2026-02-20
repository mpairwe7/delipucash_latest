import type { AppUser } from "@/types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { devtools } from 'zustand/middleware';
import { silentRefresh } from '@/services/tokenRefresh';

/**
 * Authentication key for secure storage
 */
export const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Signup credentials interface
 */
export interface SignupCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  phoneNumber?: string; // Alternative field name
}

/**
 * Authentication response interface
 */
export interface AuthResponse {
  success: boolean;
  data?: AuthData;
  message?: string;
  error?: string;
}

/**
 * Alias for AppUser (for backward compatibility)
 */
export type AuthUser = AppUser;

/**
 * Authentication data structure
 */
export interface AuthData {
  /** Short-lived JWT access token */
  token: string;
  /** Long-lived opaque refresh token */
  refreshToken: string;
  /** Authenticated user data */
  user: AppUser;
}

/**
 * Auth store state interface
 */
export interface AuthState {
  /** Whether the auth state has been initialized from storage */
  isReady: boolean;
  /** Current authentication data, or null if not authenticated */
  auth: AuthData | null;
  /** Update authentication state and persist to secure storage */
  setAuth: (auth: AuthData | null) => void;
}

/**
 * Auth modal mode type
 */
export type AuthMode = "signin" | "signup";

/**
 * Options for opening the auth modal
 */
export interface OpenAuthModalOptions {
  mode?: AuthMode;
}

/**
 * Auth modal state interface
 */
export interface AuthModalState {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Current authentication mode */
  mode: AuthMode;
  /** Open the auth modal with optional mode */
  open: (options?: OpenAuthModalOptions) => void;
  /** Close the auth modal */
  close: () => void;
}

/**
 * Authentication state store
 * 
 * @description Manages the authentication state of the application,
 * including JWT token and user data. Persists authentication to
 * Expo SecureStore for secure local storage.
 * 
 * @example
 * ```tsx
 * const { auth, setAuth, isReady } = useAuthStore();
 * 
 * if (!isReady) return <LoadingScreen />;
 * if (!auth) return <LoginScreen />;
 * return <AuthenticatedApp />;
 * ```
 */
export const useAuthStore = create<AuthState>()(
  devtools(
  (set) => ({
    isReady: false,
    auth: null,
    setAuth: (auth: AuthData | null): void => {
      // Optimistically update state, then persist asynchronously with error handling
      set({ auth });

      const persist = async () => {
        try {
          if (auth) {
            await SecureStore.setItemAsync(authKey, JSON.stringify(auth));
          } else {
            await SecureStore.deleteItemAsync(authKey);
          }
        } catch (err) {
          console.error('[AuthStore] SecureStore persistence failed:', err);
          // Rollback: if write failed and we were trying to set auth, clear it
          // to prevent "authenticated but not persisted" state
          if (auth) {
            set({ auth: null });
          }
        }
      };
      persist();
    },
  }),
  { name: 'AuthStore', enabled: __DEV__ },
  )
);

/**
 * Authentication modal state store
 * 
 * @description Controls the visibility and mode of the authentication modal.
 * Use this store to programmatically show/hide the auth modal.
 * 
 * @example
 * ```tsx
 * const { open, close, isOpen, mode } = useAuthModal();
 * 
 * // Open signup modal
 * open({ mode: 'signup' });
 * 
 * // Open signin modal
 * open({ mode: 'signin' });
 * 
 * // Close modal
 * close();
 * ```
 */
export const useAuthModal = create<AuthModalState>()(
  devtools(
  (set) => ({
    isOpen: false,
    mode: "signup",
    open: (options?: OpenAuthModalOptions): void =>
      set({ isOpen: true, mode: options?.mode || "signup" }),
    close: (): void => set({ isOpen: false }),
  }),
  { name: 'AuthModal', enabled: __DEV__ },
  )
);

// ============================================================================
// Standalone auth initializer (no hooks — safe to call outside QueryClientProvider)
// ============================================================================

/**
 * Initialize auth state from SecureStore.
 *
 * - If access token is still valid → set auth immediately.
 * - If access token expired but refresh token exists → set auth (with stale token)
 *   and mark ready so the UI renders. Then silently refresh in the background.
 *   The first protected API call will also auto-refresh via the 401 interceptor.
 * - If no refresh token → clear auth (force re-login).
 */
export function initializeAuth(): void {
  SecureStore.getItemAsync(authKey)
    .then((authString: string | null) => {
      if (!authString) {
        useAuthStore.setState({ auth: null, isReady: true });
        return;
      }

      try {
        const parsed = JSON.parse(authString) as AuthData;

        // Basic JWT expiry check (decode payload, check exp claim)
        let accessExpired = false;
        if (parsed.token) {
          try {
            const payload = JSON.parse(atob(parsed.token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              accessExpired = true;
            }
          } catch {
            // Token decode failed — treat as expired, let refresh handle it
            accessExpired = true;
          }
        }

        if (accessExpired) {
          if (parsed.refreshToken) {
            // Set stale auth immediately so UI renders with cached user data,
            // then proactively refresh the token in the background.
            // This saves one round-trip vs waiting for the first 401.
            useAuthStore.setState({ auth: parsed, isReady: true });
            proactiveRefresh(parsed.refreshToken);
          } else {
            // No refresh token — can't recover, force re-login
            SecureStore.deleteItemAsync(authKey).catch(() => {});
            useAuthStore.setState({ auth: null, isReady: true });
          }
          return;
        }

        useAuthStore.setState({ auth: parsed, isReady: true });
      } catch {
        // JSON parse failed — corrupted data, clear and start fresh
        SecureStore.deleteItemAsync(authKey).catch(() => {});
        useAuthStore.setState({ auth: null, isReady: true });
      }
    })
    .catch((err) => {
      // SecureStore read failed — set as anonymous
      console.error('[Auth] Init error:', err instanceof Error ? err.message : 'SecureStore read failed');
      useAuthStore.setState({ auth: null, isReady: true });
    });
}

/**
 * Proactively refresh an expired access token in the background.
 * Called during initializeAuth() when we detect the JWT has expired but a
 * refresh token exists.  The UI is already rendering with stale user data;
 * this just swaps in a fresh access token so the first API call succeeds
 * without the extra 401 → refresh → retry round-trip.
 *
 * 2026 fix: delegates to the shared silentRefresh() so that the cold-start
 * refresh and the 401 interceptor share the same coalescing promise. This
 * eliminates the race condition where both paths fire simultaneously, causing
 * double token rotation and family revocation on the server.
 */
function proactiveRefresh(_refreshToken: string): void {
  silentRefresh().catch(() => {
    // Network failure on startup — keep stale auth, the 401 interceptor
    // will retry later when connectivity returns.
  });
}

// ============================================================================
// AuthStore Selectors
// ============================================================================

export const selectIsReady = (s: AuthState) => s.isReady;
export const selectAuth = (s: AuthState) => s.auth;
export const selectSetAuth = (s: AuthState) => s.setAuth;

// ============================================================================
// AuthModal Selectors
// ============================================================================

export const selectIsOpen = (s: AuthModalState) => s.isOpen;
export const selectMode = (s: AuthModalState) => s.mode;
export const selectOpen = (s: AuthModalState) => s.open;
export const selectClose = (s: AuthModalState) => s.close;
