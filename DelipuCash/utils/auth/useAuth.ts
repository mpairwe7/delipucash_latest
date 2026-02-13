import { USE_MOCK_AUTH, mockLogin, mockSignup } from "@/services/mockAuth";
import { API_ROUTES } from "@/services/api";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import { AuthData, AuthMode, AuthResponse, LoginCredentials, SignupCredentials, authKey, useAuthModal, useAuthStore } from "./store";

// API Base URL for real authentication
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

/**
 * Real API login implementation
 */
async function apiLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.auth.login}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success && data.token) {
      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
        },
      };
    }

    return {
      success: false,
      error: data.message || "Login failed. Please check your credentials.",
    };
  } catch (error) {
    console.error("Login API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error. Please check your connection.",
    };
  }
}

/**
 * Real API signup implementation
 */
async function apiSignup(credentials: SignupCredentials): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ROUTES.auth.register}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        firstName: credentials.firstName || "",
        lastName: credentials.lastName || "",
        phone: credentials.phoneNumber || "",
      }),
    });

    const data = await response.json();

    if (response.ok && data.token) {
      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
        },
      };
    }

    return {
      success: false,
      error: data.message || "Signup failed. Please try again.",
    };
  } catch (error) {
    console.error("Signup API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error. Please check your connection.",
    };
  }
}

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
  const isReady = useAuthStore(s => s.isReady);
  const auth = useAuthStore(s => s.auth);
  const setAuth = useAuthStore(s => s.setAuth);
  const close = useAuthModal(s => s.close);
  const open = useAuthModal(s => s.open);
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
   * Uses mock auth in development when USE_MOCK_AUTH is true, otherwise real API
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        let response: AuthResponse;

        if (USE_MOCK_AUTH) {
          response = await mockLogin(credentials);
        } else {
          response = await apiLogin(credentials);
        }

        if (response.success && response.data?.user && response.data?.token) {
          setAuth({
            user: response.data.user,
            token: response.data.token,
          });
          close();
        }
        return response;
      } catch (error) {
        console.error("Login error:", error);
        return {
          success: false,
          error: "An unexpected error occurred. Please try again.",
        };
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, close]
  );

  /**
   * Register with credentials
   * Uses mock auth in development when USE_MOCK_AUTH is true, otherwise real API
   */
  const register = useCallback(
    async (credentials: SignupCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        let response: AuthResponse;

        if (USE_MOCK_AUTH) {
          response = await mockSignup(credentials);
        } else {
          response = await apiSignup(credentials);
        }

        if (response.success && response.data?.user && response.data?.token) {
          setAuth({
            user: response.data.user,
            token: response.data.token,
          });
          close();
        }
        return response;
      } catch (error) {
        console.error("Registration error:", error);
        return {
          success: false,
          error: "An unexpected error occurred. Please try again.",
        };
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
  const open = useAuthModal(s => s.open);

  useEffect(() => {
    if (!isAuthenticated && isReady) {
      open({ mode: options?.mode });
    }
  }, [isAuthenticated, open, options?.mode, isReady]);
};

export default useAuth;
