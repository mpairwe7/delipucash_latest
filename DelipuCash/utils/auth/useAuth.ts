import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { AuthData, AuthMode, AuthResponse, LoginCredentials, SignupCredentials, authKey, useAuthModal, useAuthStore } from "./store";
import { useLoginMutation, useSignupMutation } from "@/services/authHooks";

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

  /**
   * Robust auth init — state machine: idle → loading → authenticated|anonymous|error
   * Handles SecureStore read failures, JSON parse errors, and expired tokens.
   */
  const initiate = useCallback((): void => {
    setInitError(null);
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
          setInitError('Stored auth data was corrupted and has been cleared.');
        }
      })
      .catch((err) => {
        // SecureStore read failed — surface error, set as anonymous
        const msg = err instanceof Error ? err.message : 'SecureStore read failed';
        console.error('[Auth] Init error:', msg);
        setInitError(msg);
        useAuthStore.setState({ auth: null, isReady: true });
      });
  }, []);

  const signIn = useCallback((): void => {
    open({ mode: "signin" });
  }, [open]);

  const signUp = useCallback((): void => {
    open({ mode: "signup" });
  }, [open]);

  const signOut = useCallback((): void => {
    setAuth(null);
    close();
  }, [setAuth, close]);

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
          data: { user: data.user, token: data.token },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Login failed. Please try again.',
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
          data: { user: data.user, token: data.token },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
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
