import { useCallback } from "react";
import { useAuth } from "./useAuth";
import type { AuthUser } from "./store";

/**
 * Return type of the useUser hook
 */
export interface UseUserResult {
  /** The current authenticated user, or null if not authenticated */
  user: AuthUser | null;
  /** Alias for user (for compatibility with react-query patterns) */
  data: AuthUser | null;
  /** Whether the auth state is still being loaded */
  loading: boolean;
  /** Refetch the user data (returns current cached user) */
  refetch: () => Promise<AuthUser | null>;
}

/**
 * Hook for accessing the current authenticated user
 * 
 * @description Provides access to the current user from the auth store.
 * This is a simpler alternative to useAuth when you only need user data.
 * 
 * @returns User state and utility functions
 * 
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { user, loading } = useUser();
 *   
 *   if (loading) return <LoadingSpinner />;
 *   if (!user) return <SignInPrompt />;
 *   
 *   return (
 *     <View>
 *       <Text>Welcome, {user.firstName || user.email}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export const useUser = (): UseUserResult => {
  const { auth, isReady } = useAuth();
  const user = auth?.user || null;

  const fetchUser = useCallback(async (): Promise<AuthUser | null> => {
    return user;
  }, [user]);

  return {
    user,
    data: user,
    loading: !isReady,
    refetch: fetchUser,
  };
};

export default useUser;
