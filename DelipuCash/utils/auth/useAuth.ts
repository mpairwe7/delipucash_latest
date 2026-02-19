import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthData, AuthMode, AuthResponse, LoginCredentials, SignupCredentials, initializeAuth, useAuthModal, useAuthStore } from "./store";
import { useLoginMutation, useSignupMutation } from "@/services/authHooks";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { API_ROUTES } from "@/services/api";
import { purchasesService } from "@/services/purchasesService";

/**
 * Options for requiring authentication
 */
export interface RequireAuthOptions {
  mode?: AuthMode;
}

/**
 * Return type of the useAuth hook
 */
export interface UseAuthResult {
  /** Whether the auth state has been initialized */
  isReady: boolean;
  /** Whether the user is authenticated (null if not ready) */
  isAuthenticated: boolean | null;
  /** Open sign in modal */
  signIn: () => void;
  /** Clear authentication and close modal */
  signOut: () => void;
  /** Open sign up modal */
  signUp: () => void;
  /** Current auth data */
  auth: AuthData | null;
  /** Update auth data */
  setAuth: (auth: AuthData | null) => void;
  /** Initialize auth state from secure storage */
  initiate: () => void;
  /** Login with credentials (TanStack mutation) */
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  /** Register with credentials (TanStack mutation) */
  register: (credentials: SignupCredentials) => Promise<AuthResponse>;
  /** Loading state for auth operations */
  isLoading: boolean;
  /** Auth initialization error (if SecureStore read failed) */
  initError: string | null;
}

function toAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message?.trim();
    if (message && message !== '[object Object]') {
      return message;
    }
  }

  if (typeof error === 'string') {
    const message = error.trim();
    if (message && message !== '[object Object]') {
      return message;
    }
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'reason']) {
      const value = record[key];
      if (typeof value === 'string') {
        const message = value.trim();
        if (message && message !== '[object Object]') {
          return message;
        }
      }
    }
  }

  return fallback;
}

/**
 * Authentication hook providing sign in/out functionality
 * 
 * @description This hook provides authentication functionality including
 * sign in, sign up, sign out, and initialization from secure storage.
 * For simpler use cases, consider using `useAuthModal` or `useRequireAuth` hooks.
 * 
 * @returns Authentication state and methods
 * 
 * @example
 * ```tsx
 * function ProfileScreen() {
 *   const { isAuthenticated, signOut, auth } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <Text>Please sign in</Text>;
 *   }
 *   
 *   return (
 *     <View>
 *       <Text>Welcome, {auth?.user.email}</Text>
 *       <Button onPress={signOut} title="Sign Out" />
 *     </View>
 *   );
 * }
 * ```
 */
export const useAuth = (): UseAuthResult => {
  const isReady = useAuthStore(s => s.isReady);
  const auth = useAuthStore(s => s.auth);
  const setAuth = useAuthStore(s => s.setAuth);
  const close = useAuthModal(s => s.close);
  const open = useAuthModal(s => s.open);
  const [initError, setInitError] = useState<string | null>(null);

  // TanStack mutations for login/signup
  const loginMutation = useLoginMutation();
  const signupMutation = useSignupMutation();
  const queryClient = useQueryClient();

  /**
   * Delegates to standalone initializeAuth() from store.
   * Kept for backward compatibility with components that use useAuth().initiate.
   */
  const initiate = useCallback((): void => {
    setInitError(null);
    initializeAuth();
  }, []);

  const signIn = useCallback((): void => {
    open({ mode: "signin" });
  }, [open]);

  const signUp = useCallback((): void => {
    open({ mode: "signup" });
  }, [open]);

  const signOut = useCallback((): void => {
    // Best-effort server-side signout (invalidates refresh token on server)
    const currentAuth = useAuthStore.getState().auth;
    if (currentAuth?.token) {
      const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://delipucash-latest.vercel.app';
      const apiBase = rawApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
      fetch(`${apiBase}${API_ROUTES.auth.logout}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentAuth.token}`,
        },
      }).catch(() => {
        // Ignore — signout should always succeed locally
      });
    }

    // 1. Clear auth state (removes tokens from SecureStore)
    setAuth(null);
    close();

    // 2. Purge all cached server data to prevent data leaking between users
    queryClient.clear();

    // 3. Clear onboarding flag so a different user gets fresh onboarding
    AsyncStorage.removeItem('hasCompletedOnboarding').catch(() => {});

    // 4. Reset RevenueCat identity so purchase state doesn't leak
    if (Platform.OS !== 'web') {
      purchasesService.logout().catch(() => {
        // Non-critical — ignore if RevenueCat logout fails
      });
    }

    // 5. Reset all Zustand stores to initial state (lazy-imported to avoid cycles)
    try {
      // Dynamic requires to avoid circular dependency issues
      const { useAdStore } = require('@/store/AdStore');
      const { useAdUIStore } = require('@/store/AdUIStore');
      const { useHomeUIStore } = require('@/store/HomeUIStore');
      const { useQuizStore } = require('@/store/QuizStore');
      const { useVideoFeedStore } = require('@/store/VideoFeedStore');

      useAdStore.getState().reset?.();
      useAdUIStore.getState().reset?.();
      useHomeUIStore.getState().reset?.();
      useQuizStore.getState().resetSession?.();
      useVideoFeedStore.getState().reset?.();
    } catch {
      // Ignore — store reset is best-effort
    }

    // 6. Navigate to login screen
    router.replace('/(auth)/login');
  }, [setAuth, close, queryClient]);

  /**
   * Login via TanStack mutation — handles mock/real auth, 2FA detection.
   * Returns AuthResponse for backward compatibility with screen components.
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      try {
        const data = await loginMutation.mutateAsync(credentials);

        // 2FA required — caller should check this and enter 2FA flow
        if (data.twoFactorRequired) {
          return {
            success: true,
            message: '2FA_REQUIRED',
            data: undefined,
          };
        }

        return {
          success: true,
          data: { user: data.user, token: data.token, refreshToken: data.refreshToken },
        };
      } catch (error) {
        return {
          success: false,
          error: toAuthErrorMessage(error, 'Login failed. Please try again.'),
        };
      }
    },
    [loginMutation]
  );

  /**
   * Register via TanStack mutation.
   */
  const register = useCallback(
    async (credentials: SignupCredentials): Promise<AuthResponse> => {
      try {
        const data = await signupMutation.mutateAsync(credentials);
        return {
          success: true,
          data: { user: data.user, token: data.token, refreshToken: data.refreshToken },
        };
      } catch (error) {
        return {
          success: false,
          error: toAuthErrorMessage(error, 'Registration failed. Please try again.'),
        };
      }
    },
    [signupMutation]
  );

  return {
    isReady,
    isAuthenticated: isReady ? !!auth : null,
    signIn,
    signOut,
    signUp,
    auth,
    setAuth,
    initiate,
    login,
    register,
    isLoading: loginMutation.isPending || signupMutation.isPending,
    initError,
  };
};

/**
 * Hook that automatically opens auth modal if user is not authenticated
 * 
 * @description Use this hook on protected screens to automatically prompt
 * authentication when an unauthenticated user visits.
 * 
 * @param options - Options for the auth modal (mode: signin/signup)
 * 
 * @example
 * ```tsx
 * function ProtectedScreen() {
 *   useRequireAuth({ mode: 'signin' });
 *   
 *   return <Text>Protected Content</Text>;
 * }
 * ```
 */
export const useRequireAuth = (options?: RequireAuthOptions): void => {
  const { isAuthenticated, isReady } = useAuth();
  const open = useAuthModal(s => s.open);

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
