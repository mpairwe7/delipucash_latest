import type { AppUser } from "@/types";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { devtools } from 'zustand/middleware';

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
  /** JWT token or access token */
  token: string;
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
 * Reads persisted JWT, checks expiry, and sets useAuthStore state.
 * Safe to call from the root layout without any TanStack Query dependency.
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
        if (parsed.token) {
          try {
            const payload = JSON.parse(atob(parsed.token.split('.')[1]));
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              // Token expired — clear and treat as anonymous
              SecureStore.deleteItemAsync(authKey).catch(() => {});
              useAuthStore.setState({ auth: null, isReady: true });
              return;
            }
          } catch {
            // Token decode failed — still use it, server will reject if invalid
          }
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
