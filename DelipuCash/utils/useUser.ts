import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/utils/auth/useAuth";
import { useAuthStore } from "@/utils/auth/store";
import { userApi } from "@/services/api";
import { queryKeys } from "@/services/hooks";
import { AppUser, UserStats, SubscriptionStatus, UserRole } from "@/types";

/**
 * User profile data structure - Extended from AppUser for UI needs
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  telephone?: string; // Alias for phone
  points?: number;
  avatar?: string | null;
  role?: UserRole;
  subscriptionStatus?: SubscriptionStatus;
  surveysubscriptionStatus?: SubscriptionStatus;
  walletBalance?: number;
  totalEarnings?: number;
  totalRewards?: number;
  twoFactorEnabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Return type for useUser hook
 */
export interface UseUserResult {
  data: UserProfile | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<UseQueryResult<UserProfile | null, Error>>;
}

/**
 * Transform AppUser to UserProfile with computed fields
 */
function transformUserProfile(user: AppUser, stats?: UserStats): UserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    telephone: user.phone, // Alias for compatibility
    points: user.points,
    avatar: user.avatar,
    role: user.role, // Include role for admin checks
    subscriptionStatus: user.subscriptionStatus,
    surveysubscriptionStatus: user.surveysubscriptionStatus,
    // Use real backend values — avoid synthetic calculations that diverge from truth
    walletBalance: stats?.totalEarnings ?? 0,
    totalEarnings: stats?.totalEarnings ?? 0,
    totalRewards: stats?.totalRewards ?? 0,
    twoFactorEnabled: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Sync fresh profile data back to auth store so it persists in SecureStore.
 * This ensures that on next app launch (before API fetches complete),
 * the user sees up-to-date personal info from the persisted auth state.
 */
function syncAuthStoreUser(freshProfile: AppUser): void {
  const currentAuth = useAuthStore.getState().auth;
  if (!currentAuth) return;

  // Merge fresh profile fields into the persisted user object
  const updatedUser: AppUser = {
    ...currentAuth.user,
    firstName: freshProfile.firstName,
    lastName: freshProfile.lastName,
    phone: freshProfile.phone,
    email: freshProfile.email,
    avatar: freshProfile.avatar,
    points: freshProfile.points,
    role: freshProfile.role,
    subscriptionStatus: freshProfile.subscriptionStatus,
    surveysubscriptionStatus: freshProfile.surveysubscriptionStatus,
    updatedAt: freshProfile.updatedAt,
  };

  // Only persist if something actually changed
  const current = currentAuth.user;
  const hasChanged =
    current.firstName !== updatedUser.firstName ||
    current.lastName !== updatedUser.lastName ||
    current.phone !== updatedUser.phone ||
    current.email !== updatedUser.email ||
    current.avatar !== updatedUser.avatar ||
    current.points !== updatedUser.points ||
    current.role !== updatedUser.role;

  if (hasChanged) {
    useAuthStore.getState().setAuth({
      ...currentAuth,
      user: updatedUser,
    });
  }
}

/**
 * Hook to fetch and manage user profile data
 * 
 * Uses the canonical queryKeys.user (["user"]) so profile updates
 * from useUpdateProfile are immediately reflected. Also syncs fresh
 * profile data back to SecureStore for persistence across app restarts.
 * 
 * @returns User data, loading state, error, and refetch function
 * 
 * @example
 * ```tsx
 * const { data: user, loading, refetch } = useUser();
 * if (loading) return <LoadingSpinner />;
 * return <Text>Hello, {user?.firstName}</Text>;
 * ```
 */
export default function useUser(): UseUserResult {
  const { auth, isReady } = useAuth();
  const shouldFetchUser = isReady && Boolean(auth?.token) && Boolean(auth?.user?.id);

  // Track whether we've synced auth store to avoid redundant writes
  const lastSyncedId = useRef<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<UserProfile | null, Error>({
    // Use canonical queryKeys.user so cache is shared with useUpdateProfile
    queryKey: queryKeys.user,
    queryFn: async (): Promise<UserProfile | null> => {
      const [profileResponse, statsResponse] = await Promise.all([
        userApi.getProfile(),
        userApi.getStats(),
      ]);
      
      if (!profileResponse.success) {
        throw new Error("Failed to fetch user profile");
      }

      // Sync fresh profile data to SecureStore for persistence
      syncAuthStoreUser(profileResponse.data);
      
      const stats = statsResponse.success ? statsResponse.data : undefined;
      return transformUserProfile(profileResponse.data, stats);
    },
    enabled: shouldFetchUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Refetch when app comes back to foreground for fresh data
    refetchOnWindowFocus: true,
  });

  // Build a fallback from the persisted auth user when query data isn't ready yet.
  // This ensures personal info is visible immediately on app resume.
  const fallbackProfile: UserProfile | null = auth?.user
    ? {
        id: auth.user.id,
        email: auth.user.email,
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        phone: auth.user.phone,
        telephone: auth.user.phone,
        points: auth.user.points,
        avatar: auth.user.avatar,
        role: auth.user.role,
        subscriptionStatus: auth.user.subscriptionStatus,
        surveysubscriptionStatus: auth.user.surveysubscriptionStatus,
        walletBalance: 0,
        totalEarnings: 0,
        totalRewards: 0,
        twoFactorEnabled: false,
        createdAt: auth.user.createdAt,
        updatedAt: auth.user.updatedAt,
      }
    : null;

  return {
    // Prefer fresh API data, fall back to persisted auth store data
    data: data || fallbackProfile,
    loading: !isReady || (shouldFetchUser && isLoading && !fallbackProfile),
    error: error || null,
    refetch,
  };
}
