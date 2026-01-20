import { USE_MOCK_AUTH, mockLogin, mockSignup } from "@/services/mockAuth";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { AuthData, AuthMode, AuthResponse, LoginCredentials, SignupCredentials, authKey, useAuthModal, useAuthStore } from "./store";

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
  /** Login with credentials (for mock/real auth) */
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  /** Register with credentials (for mock/real auth) */
  register: (credentials: SignupCredentials) => Promise<AuthResponse>;
  /** Loading state for auth operations */
  isLoading: boolean;
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
  const { isReady, auth, setAuth } = useAuthStore();
  const { close, open } = useAuthModal();
  const [isLoading, setIsLoading] = useState(false);

  const initiate = useCallback((): void => {
    SecureStore.getItemAsync(authKey).then((authString: string | null) => {
      useAuthStore.setState({
        auth: authString ? (JSON.parse(authString) as AuthData) : null,
        isReady: true,
      });
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
   * Login with email and password
   * Uses mock auth in development, real API in production
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        if (USE_MOCK_AUTH) {
          const response = await mockLogin(credentials);
          if (response.success && response.user && response.token) {
            setAuth({
              user: response.user,
              token: response.token,
            });
            close();
          }
          return response;
        } else {
          // Real API implementation would go here
          // For now, return error indicating API not configured
          return {
            success: false,
            error: "API not configured. Enable mock auth for development.",
          };
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, close]
  );

  /**
   * Register with credentials
   * Uses mock auth in development, real API in production
   */
  const register = useCallback(
    async (credentials: SignupCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        if (USE_MOCK_AUTH) {
          const response = await mockSignup(credentials);
          if (response.success && response.user && response.token) {
            setAuth({
              user: response.user,
              token: response.token,
            });
            close();
          }
          return response;
        } else {
          // Real API implementation would go here
          return {
            success: false,
            error: "API not configured. Enable mock auth for development.",
          };
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, close]
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
    isLoading,
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
  const { open } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
