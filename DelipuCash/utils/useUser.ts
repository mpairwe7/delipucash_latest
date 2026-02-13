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
