import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useAuth } from "@/utils/auth/useAuth";
import { userApi } from "@/services/api";
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
    subscriptionStatus: user.subscriptionStatus,
    surveysubscriptionStatus: user.surveysubscriptionStatus,
    // Computed fields from stats
    walletBalance: stats?.totalEarnings ? stats.totalEarnings - (stats.totalEarnings * 0.5) : user.points / 100,
    totalEarnings: stats?.totalEarnings || user.points / 50,
    totalRewards: stats?.totalRewards || user.points,
    twoFactorEnabled: false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Hook to fetch and manage user profile data
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

  const { data, isLoading, error, refetch } = useQuery<UserProfile | null, Error>({
    queryKey: ["user", auth?.user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      // Use mock API to get user profile
      const [profileResponse, statsResponse] = await Promise.all([
        userApi.getProfile(),
        userApi.getStats(),
      ]);
      
      if (!profileResponse.success) {
        throw new Error("Failed to fetch user profile");
      }
      
      const stats = statsResponse.success ? statsResponse.data : undefined;
      return transformUserProfile(profileResponse.data, stats);
    },
    // Enable even without auth for mock data development
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    data: data || (auth?.user as UserProfile | null) || null,
    loading: !isReady || isLoading,
    error: error || null,
    refetch,
  };
}
