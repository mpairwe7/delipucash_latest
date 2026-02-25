/**
 * Profile Screen - Radically Redesigned (2025-2026 Standards)
 * 
 * Design Inspiration: Instagram, TikTok, LinkedIn, Cash App, Duolingo
 * 
 * Architecture:
 * - Modular component structure (ProfileHeader, EarningsOverview, QuickActionsGrid, etc.)
 * - FlatList virtualization for performance
 * - Zustand for UI state (theme), TanStack Query for server state
 * - Full WCAG 2.2 AA accessibility compliance
 * 
 * Features:
 * - Hero header with avatar, personalized greeting, and stats
 * - Earnings overview card with gradient and quick actions
 * - Quick access grid with spring animations
 * - Collapsible settings sections
 * - Achievement badges showcase
 * - Recent activity feed
 * - Smooth dark/light mode transitions
 * - Reusable OTP verification modal
 * 
 * Performance:
 * - FlatList with optimized renderItem
 * - Memoized components
 * - Reanimated for smooth 60fps animations
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  FlatList,
  ListRenderItemInfo,
  Modal,
  RefreshControl,
  TextInput,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStatusBar } from '@/hooks/useStatusBar';
import { Href, router } from 'expo-router';
import * as Haptics from '@/utils/haptics';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import {
  Award,
  Coins,
  Gift,
  HelpCircle,
  Mail,
  MessageSquare,
  History,
  Megaphone,
  Sparkles,
  Upload,
  PlusCircle,
  Shield,
  Bell,
  KeyRound,
  Smartphone,
  Moon,
  Sun,
  Palette,
  Globe,
  LogOut,
  ChevronRight,
  Settings,
  Settings2,
  Users,
} from 'lucide-react-native';

// Components
import { NotificationBell, SectionHeader } from '@/components';
import {
  ProfileUserCard,
  QuickActionsGrid,
  SettingsSection,
  OTPVerificationModal,
  ProfileSkeleton,
  AccessibleText,
  AnimatedCard,
  EditProfileModal,
  ChangePasswordModal,
  TransactionsCard,
} from '@/components/profile';
import { QuickSettingsSheet } from '@/components/profile/QuickSettingsSheet';
import type { ProfileQuickAction } from '@/components/profile/QuickActionsGrid';
import type { SettingItem } from '@/components/profile/SettingsSection';
import type { EditProfileData } from '@/components/profile/EditProfileModal';
import type { RecentTransaction } from '@/components/profile/TransactionsCard';

// Services & Hooks
import {
  useChangePassword,
  useResend2FACode,
  useRevokeSession,
  useTransactions,
  useUpdateProfile,
  useUpdateTwoFactor,
  useUserSessions,
  useUserStats,
  useVerify2FACode,
} from '@/services/hooks';
import { useUnreadNotificationCount } from '@/services/notificationHooks';
import { uploadAvatarToR2 } from '@/services/r2UploadService';
import { useSurveyCreatorAccess } from '@/services/purchasesHooks';
import { useAuth } from '@/utils/auth/useAuth';

import useUser from '@/utils/useUser';
import { UserRole } from '@/types';
import { RewardSettingsSheet } from '@/components/profile/RewardSettingsSheet';
import { useRewardConfig, pointsToUgx, ugxToPoints } from '@/services/configHooks';
import { useToast } from '@/components/ui/Toast';

// Theme
import {
  SPACING,
  ICON_SIZE,
  useTheme,
  useThemeStore,
  withAlpha,
} from '@/utils/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

// Section types for FlatList
type SectionType =
  | 'header'
  | 'transactions'
  | 'quickActions'
  | 'rewards'
  | 'achievements'
  | 'recentActivity'
  | 'settings'
  | 'support'
  | 'signOut';

interface SectionItem {
  type: SectionType;
  id: string;
}

// ============================================================================
// ESTIMATED SECTION HEIGHTS (for getItemLayout)
// These don't need to be exact — rough estimates prevent layout thrashing
// and eliminate the VirtualizedList slow-update warning
// ============================================================================
const SECTION_HEIGHTS: Record<SectionType, number> = {
  header: 340,
  transactions: 420,
  quickActions: 340,
  rewards: 320,
  achievements: 0,    // not currently rendered
  recentActivity: 0,  // not currently rendered
  settings: 500,
  support: 160,
  signOut: 120,
};

const SECTION_SEPARATOR = 0; // FlatList has no separator between sections

/**
 * Pre-compute cumulative offsets for getItemLayout.
 * This is called once per render of the sections array (which is stable).
 */
function buildGetItemLayout(sections: SectionItem[]) {
  // Pre-build cumulative offsets
  const offsets: number[] = [];
  let cumulative = 0;
  for (const section of sections) {
    offsets.push(cumulative);
    cumulative += SECTION_HEIGHTS[section.type] + SECTION_SEPARATOR;
  }
  return (_data: ArrayLike<SectionItem> | null | undefined, index: number) => ({
    length: SECTION_HEIGHTS[sections[index]?.type ?? 'header'],
    offset: offsets[index] ?? 0,
    index,
  });
}

// ============================================================================
// MEMOIZED SECTION RENDERERS
// Extracted from renderItem to avoid re-creating heavy JSX trees.
// Each is wrapped in React.memo so it only re-renders when its own props change.
// ============================================================================

interface HeaderSectionProps {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    telephone: string;
    avatarUri?: string;
    walletBalance: number;
    totalEarnings: number;
    totalRewards: number;
    streakDays: number;
    isVerified: boolean;
    activeSessions: number;
  };
  onEditPress: () => void;
}

const HeaderSection = memo(function HeaderSection({ profile, onEditPress }: HeaderSectionProps) {
  return (
    <View style={styles.sectionContainer}>
      <ProfileUserCard
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email}
        phone={profile.telephone}
        isVerified={profile.isVerified}
        avatarUri={profile.avatarUri}
        totalEarnings={profile.totalEarnings}
        walletBalance={profile.walletBalance}
        streakDays={profile.streakDays}
        maxStreak={30}
        onEditPress={onEditPress}
        onAvatarPress={onEditPress}
        onEarningsPress={() => router.push('/(tabs)/transactions')}
        onWalletPress={() => router.push('/(tabs)/withdraw' as Href)}
        onStreakPress={() => Alert.alert('Streak Bonus', `Keep your ${profile.streakDays}-day streak going to earn bonus rewards!`)}
      />
    </View>
  );
});

interface TransactionsSectionProps {
  profile: { totalEarnings: number; streakDays: number };
  recentTransactions: RecentTransaction[];
}

const TransactionsSection = memo(function TransactionsSection({ profile, recentTransactions }: TransactionsSectionProps) {
  return (
    <View style={styles.sectionContainer}>
      <TransactionsCard
        totalEarned={profile.totalEarnings}
        currentStreak={profile.streakDays}
        maxStreak={30}
        recentTransactions={recentTransactions}
        onPress={() => router.push('/(tabs)/transactions')}
        onStreakPress={() => Alert.alert('Streak Bonus', `Keep your ${profile.streakDays}-day streak going to earn bonus rewards!`)}
      />
    </View>
  );
});

interface QuickActionsSectionProps {
  quickAccessItems: ProfileQuickAction[];
  isAdmin: boolean;
  hasSurveySubscription: boolean;
  onSubscriptionRequired: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const QuickActionsSection = memo(function QuickActionsSection({
  quickAccessItems,
  isAdmin,
  hasSurveySubscription,
  onSubscriptionRequired,
  colors,
}: QuickActionsSectionProps) {
  return (
    <View style={styles.sectionContainer}>
      <SectionHeader
        title="Quick Access"
        subtitle="Frequently used features"
        icon={<Sparkles size={ICON_SIZE.base} color={colors.primary} />}
      />
      <QuickActionsGrid
        items={quickAccessItems}
        isAdmin={isAdmin}
        hasSubscription={hasSurveySubscription}
        onSubscriptionRequired={onSubscriptionRequired}
      />
    </View>
  );
});

interface SettingsSectionBlockProps {
  securitySettings: SettingItem[];
  appearanceSettings: SettingItem[];
  colors: ReturnType<typeof useTheme>['colors'];
}

const SettingsSectionBlock = memo(function SettingsSectionBlock({
  securitySettings,
  appearanceSettings,
  colors,
}: SettingsSectionBlockProps) {
  return (
    <View style={styles.sectionContainer}>
      <SettingsSection
        title="Security"
        subtitle="Protect your account"
        icon={<Shield size={ICON_SIZE.base} color={colors.success} />}
        items={securitySettings}
        animationDelay={0}
      />
      <SettingsSection
        title="Appearance"
        subtitle="Customize your experience"
        icon={<Palette size={ICON_SIZE.base} color={colors.info} />}
        items={appearanceSettings}
        animationDelay={100}
      />
    </View>
  );
});

interface RewardsSectionBlockProps {
  rewardSettings: SettingItem[];
  colors: ReturnType<typeof useTheme>['colors'];
}

const RewardsSectionBlock = memo(function RewardsSectionBlock({
  rewardSettings,
  colors,
}: RewardsSectionBlockProps) {
  return (
    <View style={styles.sectionContainer}>
      <SettingsSection
        title="Rewards"
        subtitle="Points and withdrawal info"
        icon={<Coins size={ICON_SIZE.base} color={colors.warning} />}
        items={rewardSettings}
        animationDelay={0}
      />
    </View>
  );
});

const SUPPORT_EMAIL = 'mpairwelauben75@gmail.com';

interface SupportSectionProps {
  colors: ReturnType<typeof useTheme>['colors'];
}

const SupportSection = memo(function SupportSection({ colors }: SupportSectionProps) {
  const handleEmailPress = useCallback(async () => {
    try {
      const url = `mailto:${SUPPORT_EMAIL}?subject=DelipuCash%20Support%20Request`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch {
      // Silently fail — no email client installed
    }
  }, []);

  const cardStyle = useMemo(
    () => ({ borderColor: withAlpha(colors.info, 0.2) }),
    [colors.info],
  );
  const iconBgStyle = useMemo(
    () => [styles.supportIcon, { backgroundColor: withAlpha(colors.info, 0.1) }],
    [colors.info],
  );

  return (
    <View style={styles.sectionContainer}>
      <AnimatedCard
        variant="outlined"
        onPress={handleEmailPress}
        hapticType="light"
        accessibilityLabel={`Contact support at ${SUPPORT_EMAIL}`}
        accessibilityRole="link"
        accessibilityHint="Opens your email app to contact support"
        style={cardStyle}
      >
        <View style={styles.supportContent}>
          <View style={iconBgStyle}>
            <Mail size={ICON_SIZE.lg} color={colors.info} strokeWidth={2} />
          </View>
          <View style={styles.supportText}>
            <AccessibleText variant="body" medium>Need Help?</AccessibleText>
            <AccessibleText variant="caption" color="textMuted">
              {SUPPORT_EMAIL}
            </AccessibleText>
          </View>
          <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} />
        </View>
      </AnimatedCard>
    </View>
  );
});

interface SignOutSectionProps {
  onSignOut: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

const SignOutSection = memo(function SignOutSection({ onSignOut, colors }: SignOutSectionProps) {
  return (
    <View style={[styles.sectionContainer, styles.signOutSection]}>
      <AnimatedCard
        variant="outlined"
        onPress={onSignOut}
        hapticType="medium"
        accessibilityLabel="Sign out of your account"
        accessibilityHint="Tap to sign out"
        style={{ borderColor: withAlpha(colors.error, 0.3) }}
      >
        <View style={styles.signOutContent}>
          <View style={[styles.signOutIcon, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
            <LogOut size={ICON_SIZE.lg} color={colors.error} strokeWidth={2} />
          </View>
          <AccessibleText variant="body" medium customColor={colors.error}>
            Sign Out
          </AccessibleText>
          <ChevronRight size={ICON_SIZE.base} color={colors.error} />
        </View>
      </AnimatedCard>
    </View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfileScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, style: statusBarStyle, isDark } = useStatusBar(); // Focus-aware status bar management
  const layout = useResponsiveLayout();
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const { signOut } = useAuth();
  const { showToast } = useToast();
  
  // Data fetching
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { data: unreadCount, refetch: refetchUnread } = useUnreadNotificationCount();
  const { data: userStats, isLoading: statsLoading, refetch: refetchStats } = useUserStats();
  const { data: sessions = [], refetch: refetchSessions } = useUserSessions();
  const { canCreateSurvey, refetch: refetchSubscription } = useSurveyCreatorAccess();
  const { data: transactions = [] } = useTransactions();
  
  // Mutations
  const updateProfileMutation = useUpdateProfile();
  const updateTwoFactorMutation = useUpdateTwoFactor();
  const verify2FAMutation = useVerify2FACode();
  const resend2FAMutation = useResend2FACode();
  const changePasswordMutation = useChangePassword();
  const revokeSessionMutation = useRevokeSession();

  // Local state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(user?.twoFactorEnabled));
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showDisable2FAPrompt, setShowDisable2FAPrompt] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRewardSettings, setShowRewardSettings] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [enable2FAError, setEnable2FAError] = useState<string | null>(null);
  const [disable2FAError, setDisable2FAError] = useState<string | null>(null);
  // Tracks whether the pending disable-2FA mutation is a resend (vs verify)
  const [isDisable2FAResending, setIsDisable2FAResending] = useState(false);

  // Subscription status (via RevenueCat entitlements)
  const hasSurveySubscription = canCreateSurvey;

  // Admin check
  const isAdmin = useMemo(() => {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  }, [user?.role]);

  // Update local state when user data loads
  useEffect(() => {
    if (user) {
      setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
    }
  }, [user]);

  const responsivePadding = layout.select({
    phone: layout.isSmallPhone ? 16 : 20,
    tablet: 32,
  });

  // Profile data — defensive: treat null / undefined / whitespace-only as absent
  const profile = useMemo(() => {
    const trimOrEmpty = (v: string | null | undefined): string =>
      (v ?? '').trim();
    // Cache-bust avatar URL so ExpoImage doesn't show stale image after update
    const rawAvatar = user?.avatar || undefined;
    const avatarUri = rawAvatar && user?.updatedAt && !rawAvatar.startsWith('file://')
      ? `${rawAvatar}${rawAvatar.includes('?') ? '&' : '?'}v=${encodeURIComponent(user.updatedAt)}`
      : rawAvatar;
    return {
      firstName: trimOrEmpty(user?.firstName),
      lastName: trimOrEmpty(user?.lastName),
      email: trimOrEmpty(user?.email),
      telephone: trimOrEmpty(user?.telephone ?? user?.phone),
      avatarUri,
      walletBalance: user?.walletBalance ?? 0,
      totalEarnings: user?.totalEarnings || userStats?.totalEarnings || 0,
      totalRewards: user?.totalRewards || userStats?.totalRewards || 0,
      streakDays: userStats?.currentStreak || 0,
      // Verification must come from an authoritative backend flag;
      // the mere existence of an email string is not proof of verification.
      isVerified: Boolean(user?.emailVerified),
      activeSessions: sessions.filter(s => s.isActive).length,
    };
  }, [user, userStats, sessions]);

  // Quick access items
  const quickAccessItems: ProfileQuickAction[] = useMemo(() => [
    {
      id: 'rewards',
      title: 'My Rewards',
      icon: Gift,
      iconColor: '#FFC107',
      iconBgColor: 'rgba(255, 193, 7, 0.1)',
      onPress: () => {
        Alert.alert('My Rewards', 'View and claim your earned rewards here!');
      },
      accessibilityHint: 'View your earned rewards and redeem them',
    },
    {
      id: 'help-support',
      title: 'Help & Support',
      icon: HelpCircle,
      iconColor: '#2196F3',
      iconBgColor: 'rgba(33, 150, 243, 0.1)',
      route: '/help-support',
      accessibilityHint: 'Get help and contact support',
    },
    {
      id: 'surveys',
      title: 'My Surveys',
      icon: MessageSquare,
      iconColor: '#007B55',
      iconBgColor: 'rgba(0, 123, 85, 0.1)',
      route: '/(tabs)/surveys-new',
      accessibilityHint: 'View and manage your surveys',
    },
    {
      id: 'transactions',
      title: 'Transactions',
      icon: History,
      iconColor: '#9C27B0',
      iconBgColor: 'rgba(156, 39, 176, 0.1)',
      route: '/(tabs)/transactions',
      accessibilityHint: 'View your transaction history',
    },
    {
      id: 'create-ad',
      title: 'Create Ad',
      icon: Megaphone,
      iconColor: '#FF5722',
      iconBgColor: 'rgba(255, 87, 34, 0.1)',
      route: '/ad-registration',
      adminOnly: true,
      accessibilityHint: 'Create a new advertisement',
    },
    {
      id: 'create-instant-reward',
      title: 'Create Instant Reward',
      icon: Sparkles,
      iconColor: '#FFC107',
      iconBgColor: 'rgba(255, 193, 7, 0.1)',
      route: '/instant-reward-upload',
      adminOnly: true,
      accessibilityHint: 'Create a new instant reward question',
    },
    {
      id: 'create-regular-reward',
      title: 'Create Regular Reward',
      icon: Award,
      iconColor: '#4CAF50',
      iconBgColor: 'rgba(76, 175, 80, 0.1)',
      route: '/regular-reward-upload',
      adminOnly: true,
      accessibilityHint: 'Create a new regular reward question',
    },
    {
      id: 'reward-settings',
      title: 'Reward Settings',
      icon: Settings2,
      iconColor: '#FF9800',
      iconBgColor: 'rgba(255, 152, 0, 0.1)',
      onPress: () => setShowRewardSettings(true),
      adminOnly: true,
      accessibilityHint: 'Configure survey reward rates and withdrawal limits',
    },
    {
      id: 'upload-questions-file',
      title: 'Upload Questions',
      icon: Upload,
      iconColor: '#2196F3',
      iconBgColor: 'rgba(33, 150, 243, 0.1)',
      route: '/file-upload',
      adminOnly: true,
      accessibilityHint: 'Upload questions via file',
    },
    {
      id: 'create-survey',
      title: 'Create Survey',
      icon: PlusCircle,
      iconColor: '#FF9800',
      iconBgColor: 'rgba(255, 152, 0, 0.1)',
      route: '/create-survey',
      requiresSubscription: true,
      accessibilityHint: 'Create a new survey (subscription required)',
    },
  ], []);

  // Recent transactions — map from backend Transaction[] to RecentTransaction[]
  const recentTransactions: RecentTransaction[] = useMemo(() => {
    if (!transactions.length) return [];
    return transactions.slice(0, 5).map((tx) => ({
      id: tx.id,
      type: tx.type === 'payment' ? 'deposit' as const : tx.type,
      amount: tx.amount,
      title: tx.description || tx.type,
      createdAt: new Date(tx.createdAt),
      status: tx.status === 'SUCCESSFUL' ? 'completed' as const
        : tx.status === 'FAILED' ? 'failed' as const
        : 'pending' as const,
    }));
  }, [transactions]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchUser(),
      refetchSessions(),
      refetchStats(),
      refetchUnread(),
      refetchSubscription(),
    ]);
    setIsRefreshing(false);
    AccessibilityInfo.announceForAccessibility('Profile refreshed');
  }, [refetchUser, refetchSessions, refetchStats, refetchUnread, refetchSubscription]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  const handleSubscriptionRequired = useCallback(() => {
    Alert.alert(
      'Subscription Required',
      'You need an active subscription to create surveys. Subscribe now to unlock this feature.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: () => router.push('/(tabs)/surveys-new' as Href),
          style: 'default',
        },
      ]
    );
  }, []);

  // Memoize the user object passed to EditProfileModal so it only changes
  // when actual field values change — prevents the modal's useEffect from
  // re-firing on every parent re-render due to a new object reference.
  const editProfileUser = useMemo(() => ({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    telephone: profile.telephone,
    avatarUri: profile.avatarUri,
  }), [profile.firstName, profile.lastName, profile.email, profile.telephone, profile.avatarUri]);

  const handleEditProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEditProfileModal(true);
  }, []);

  const handleSaveProfile = useCallback(async (data: EditProfileData) => {
    try {
      // Sanitise inputs — trim whitespace before persisting
      const firstName = (data.firstName ?? '').trim();
      const lastName = (data.lastName ?? '').trim();
      const phone = (data.telephone ?? '').trim();

      // Upload avatar to R2 if it's a local file (file:// URI from image picker).
      // If it's already an HTTP URL (existing avatar) or null, pass through as-is.
      let avatarUrl: string | null = data.avatarUri ?? null;
      if (data.avatarUri && data.avatarUri.startsWith('file://')) {
        const uploadResult = await uploadAvatarToR2(data.avatarUri);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload profile photo');
        }
        avatarUrl = uploadResult.data.url;
      }

      // Map telephone (UI field name) to phone (API/Prisma field name)
      await updateProfileMutation.mutateAsync({
        firstName,
        lastName,
        phone,
        avatar: avatarUrl,
      });
      // Refetch so the profile screen shows fresh data immediately when
      // the modal's success animation finishes and auto-closes.
      await refetchUser();
      // Modal auto-closes after its 1200ms success animation (Instagram pattern).
      // No manual setShowEditProfileModal(false) or Alert needed here.
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile. Please try again.');
      throw error;
    }
  }, [updateProfileMutation, refetchUser]);

  const handleToggle2FA = useCallback(() => {
    // Guard against double-tap / concurrent invocations
    if (updateTwoFactorMutation.isPending) return;

    if (twoFactorEnabled) {
      // Disable flow — prompt for password (backend requires it)
      setDisable2FAPassword('');
      setShowDisable2FAPrompt(true);
    } else {
      // Enable flow - request verification code
      updateTwoFactorMutation.mutate(
        { enabled: true },
        {
          onSuccess: (data) => {
            if (data.codeSent) {
              setMaskedEmail(data.email || '');
              const expiresIn = data.expiresIn || 180;
              setOtpExpiresAt(Date.now() + expiresIn * 1000);
              setShow2FAModal(true);
            }
          },
          onError: (error) => {
            showToast({ type: 'error', message: error.message || 'Failed to send verification code.' });
          },
        }
      );
    }
  }, [twoFactorEnabled, updateTwoFactorMutation, showToast]);

  // State for disable-2FA OTP step
  const [showDisable2FAOTPModal, setShowDisable2FAOTPModal] = useState(false);
  const [disable2FAMaskedEmail, setDisable2FAMaskedEmail] = useState('');
  const [disable2FAOtpExpiresAt, setDisable2FAOtpExpiresAt] = useState<number | null>(null);

  const handleConfirmDisable2FA = useCallback(() => {
    if (!disable2FAPassword.trim()) {
      showToast({ type: 'error', message: 'Password is required to disable 2FA.' });
      return;
    }
    // Step 1: Send password → backend sends OTP code
    updateTwoFactorMutation.mutate(
      { enabled: false, password: disable2FAPassword },
      {
        onSuccess: (data) => {
          if (data.codeSent) {
            // Backend sent OTP — show OTP modal
            setShowDisable2FAPrompt(false);
            setDisable2FAMaskedEmail(data.email || '');
            setDisable2FAOtpExpiresAt(Date.now() + (data.expiresIn || 180) * 1000);
            setShowDisable2FAOTPModal(true);
          } else if (data.enabled === false) {
            // Directly disabled (shouldn't happen with new backend, but handle gracefully)
            setTwoFactorEnabled(false);
            setShowDisable2FAPrompt(false);
            setDisable2FAPassword('');
            showToast({ type: 'success', message: 'Two-factor authentication has been disabled.' });
          }
        },
        onError: (error) => {
          showToast({ type: 'error', message: error.message || 'Failed to disable 2FA.' });
        },
      }
    );
  }, [disable2FAPassword, updateTwoFactorMutation, showToast]);

  /** Step 2: Verify OTP code to complete disabling 2FA.
   *  Uses mutateAsync to avoid the race condition where a concurrent
   *  .mutate() call (e.g. resend) would silently discard these callbacks.
   */
  const handleVerifyDisable2FA = useCallback(async (code: string) => {
    setDisable2FAError(null);
    try {
      await updateTwoFactorMutation.mutateAsync({ enabled: false, password: disable2FAPassword, code });
      setTwoFactorEnabled(false);
      setShowDisable2FAOTPModal(false);
      setDisable2FAPassword('');
      setDisable2FAError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ type: 'success', message: 'Two-factor authentication has been disabled.' });
    } catch (err: any) {
      setDisable2FAError(err.message || 'Invalid verification code.');
    }
  }, [disable2FAPassword, updateTwoFactorMutation, showToast]);

  /** Resend disable-2FA OTP code.
   *  Uses mutateAsync to avoid callback-cancellation race with verify.
   */
  const handleResendDisable2FA = useCallback(async () => {
    setDisable2FAError(null);
    setIsDisable2FAResending(true);
    try {
      const data = await updateTwoFactorMutation.mutateAsync({ enabled: false, password: disable2FAPassword });
      if (data.codeSent) {
        setDisable2FAOtpExpiresAt(Date.now() + (data.expiresIn || 180) * 1000);
      }
    } catch (err: any) {
      setDisable2FAError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsDisable2FAResending(false);
    }
  }, [disable2FAPassword, updateTwoFactorMutation]);

  const handleVerify2FA = useCallback((code: string) => {
    setEnable2FAError(null);
    verify2FAMutation.mutate(code, {
      onSuccess: () => {
        setTwoFactorEnabled(true);
        setShow2FAModal(false);
        setMaskedEmail('');
        setOtpExpiresAt(null);
        setEnable2FAError(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ type: 'success', message: 'Two-factor authentication is now active.' });
      },
      onError: (err) => {
        setEnable2FAError(err.message || 'Invalid verification code.');
      },
    });
  }, [verify2FAMutation, showToast]);

  const handleResend2FA = useCallback(() => {
    setEnable2FAError(null);
    resend2FAMutation.mutate(undefined, {
      onSuccess: (data) => {
        setMaskedEmail(data.email || '');
        const expiresIn = data.expiresIn || 180;
        setOtpExpiresAt(Date.now() + expiresIn * 1000);
      },
      onError: (err) => {
        setEnable2FAError(err.message || 'Failed to resend verification code.');
      },
    });
  }, [resend2FAMutation]);

  // FlatList ref for programmatic scrolling (e.g. "All Settings" in QuickSettingsSheet)
  const flatListRef = useRef<FlatList<SectionItem>>(null);

  // Tracks whether password change succeeded so the toast fires AFTER
  // the modal's success animation and auto-close (not during the save callback).
  const passwordChangeSucceeded = useRef(false);

  const handleChangePassword = useCallback(() => {
    passwordChangeSucceeded.current = false;
    setShowChangePasswordModal(true);
  }, []);

  const handleConfirmChangePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await changePasswordMutation.mutateAsync(
      { currentPassword, newPassword },
    );
    // Don't toast here — modal shows success check animation first.
    // Toast fires in onClose after the 1200ms auto-close.
    passwordChangeSucceeded.current = true;
  }, [changePasswordMutation]);

  const handleManageSessions = useCallback(() => {
    const activeSessions = sessions.filter(s => s.isActive);
    if (activeSessions.length <= 1) {
      Alert.alert('Sessions', 'Only your current session is active.');
      return;
    }
    Alert.alert(
      `${activeSessions.length} Active Sessions`,
      'Would you like to revoke all other sessions?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Others',
          style: 'destructive',
          onPress: async () => {
            try {
              const others = activeSessions.slice(1);
              await Promise.all(others.map(s => revokeSessionMutation.mutateAsync(s.id)));
              await refetchSessions();
              Alert.alert('Success', 'Other sessions revoked.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to revoke sessions.');
            }
          },
        },
      ]
    );
  }, [sessions, revokeSessionMutation, refetchSessions]);

  // Quick settings handlers
  const handleOpenQuickSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowQuickSettings(true);
  }, []);

  const handleScrollToSettings = useCallback(() => {
    // 'settings' is at index 4 in the sections array — use hardcoded index
    // since sections order is stable and defined in the useMemo below
    flatListRef.current?.scrollToIndex({ index: 4, animated: true });
  }, []);

  // ============================================================================
  // REWARD CONFIG (reactive to admin changes)
  // ============================================================================

  const { data: rewardConfig } = useRewardConfig();

  const rewardSettings: SettingItem[] = useMemo(() => {
    if (!rewardConfig) return [];

    const ratePerPoint = Math.floor(rewardConfig.pointsToCashNumerator / rewardConfig.pointsToCashDenominator);
    const regularPoints = ugxToPoints(rewardConfig.defaultRegularRewardAmount, rewardConfig);
    const instantPoints = ugxToPoints(rewardConfig.defaultInstantRewardAmount, rewardConfig);
    const minUgx = pointsToUgx(rewardConfig.minWithdrawalPoints, rewardConfig);
    const referralUgx = pointsToUgx(rewardConfig.referralBonusPoints, rewardConfig);

    const items: SettingItem[] = [
      {
        type: 'info',
        id: 'points-rate',
        label: 'Points Rate',
        subtitle: `1 point = ${ratePerPoint.toLocaleString()} UGX`,
        icon: <Coins size={ICON_SIZE.base} color={colors.warning} />,
      },
      {
        type: 'info',
        id: 'regular-reward',
        label: 'Regular Reward',
        subtitle: `${regularPoints} points per answer`,
        rightText: `${rewardConfig.defaultRegularRewardAmount.toLocaleString()} UGX`,
        icon: <Award size={ICON_SIZE.base} color={colors.success} />,
      },
      {
        type: 'info',
        id: 'instant-reward',
        label: 'Instant Reward',
        subtitle: `${instantPoints} points per answer`,
        rightText: `${rewardConfig.defaultInstantRewardAmount.toLocaleString()} UGX`,
        icon: <Sparkles size={ICON_SIZE.base} color={colors.primary} />,
      },
      {
        type: 'info',
        id: 'min-withdrawal',
        label: 'Min Withdrawal',
        subtitle: `${rewardConfig.minWithdrawalPoints} points (${minUgx.toLocaleString()} UGX)`,
        icon: <Gift size={ICON_SIZE.base} color={colors.info} />,
      },
      {
        type: 'info',
        id: 'referral-bonus',
        label: 'Referral Bonus',
        subtitle: `${rewardConfig.referralBonusPoints} points each (${referralUgx.toLocaleString()} UGX)`,
        icon: <Users size={ICON_SIZE.base} color="#9C27B0" />,
      },
    ];

    if (isAdmin) {
      items.push({
        type: 'navigation',
        id: 'configure-rewards',
        label: 'Configure',
        subtitle: 'Change reward rates and limits',
        icon: <Settings2 size={ICON_SIZE.base} color={colors.warning} />,
        onPress: () => setShowRewardSettings(true),
        accessibilityHint: 'Open reward configuration settings',
      });
    }

    return items;
  }, [rewardConfig, isAdmin, colors]);

  // ============================================================================
  // SETTINGS ITEMS
  // ============================================================================

  const securitySettings: SettingItem[] = useMemo(() => [
    {
      type: 'toggle',
      id: '2fa',
      label: 'Two-Factor Authentication',
      subtitle: twoFactorEnabled ? 'Enabled — OTP required at sign-in' : 'Disabled — enable for extra security',
      icon: <Shield size={ICON_SIZE.base} color={colors.primary} />,
      value: twoFactorEnabled,
      onChange: handleToggle2FA,
      disabled: updateTwoFactorMutation.isPending,
      loading: updateTwoFactorMutation.isPending,
      accessibilityHint: twoFactorEnabled
        ? 'Double tap to disable two-factor authentication'
        : 'Double tap to enable two-factor authentication via email code',
    },
    {
      type: 'navigation',
      id: 'password',
      label: 'Change Password',
      subtitle: 'Update your password',
      icon: <KeyRound size={ICON_SIZE.base} color={colors.info} />,
      onPress: handleChangePassword,
    },
    {
      type: 'navigation',
      id: 'sessions',
      label: 'Active Sessions',
      subtitle: `${profile.activeSessions} device${profile.activeSessions !== 1 ? 's' : ''}`,
      icon: <Smartphone size={ICON_SIZE.base} color={colors.warning} />,
      onPress: handleManageSessions,
    },
  ], [twoFactorEnabled, handleToggle2FA, handleChangePassword, handleManageSessions, colors, profile.activeSessions, updateTwoFactorMutation.isPending]);

  const appearanceSettings: SettingItem[] = useMemo(() => [
    {
      type: 'toggle',
      id: 'darkMode',
      label: isDark ? 'Dark Mode' : 'Light Mode',
      subtitle: isDark ? 'Easier on your eyes' : 'Bright and clear',
      icon: isDark
        ? <Moon size={ICON_SIZE.base} color={colors.primary} />
        : <Sun size={ICON_SIZE.base} color={colors.warning} />,
      value: isDark,
      onChange: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleTheme();
      },
    },
    {
      type: 'navigation',
      id: 'notifications',
      label: 'Notifications',
      subtitle: 'Manage push notifications',
      icon: <Bell size={ICON_SIZE.base} color={colors.info} />,
      onPress: () => router.push('/notifications' as Href),
    },
    {
      type: 'info',
      id: 'language',
      label: 'Language',
      subtitle: 'English (Default)',
      icon: <Globe size={ICON_SIZE.base} color={colors.textMuted} />,
    },
  ], [isDark, colors, toggleTheme]);

  // ============================================================================
  // FLAT LIST SECTIONS
  // ============================================================================

  const sections: SectionItem[] = useMemo(() => [
    { type: 'header', id: 'header' },
    { type: 'transactions', id: 'transactions' },
    { type: 'quickActions', id: 'quickActions' },
    { type: 'rewards', id: 'rewards' },
    { type: 'settings', id: 'settings' },
    { type: 'support', id: 'support' },
    { type: 'signOut', id: 'signOut' },
  ], []);

  // Pre-compute getItemLayout for the stable sections array
  const getItemLayout = useMemo(() => buildGetItemLayout(sections), [sections]);

  // renderItem delegates to memoized section components so each section
  // only re-renders when its own props change — fixes the "large list slow to update" warning
  const renderItem = useCallback(({ item }: ListRenderItemInfo<SectionItem>) => {
    switch (item.type) {
      case 'header':
        return <HeaderSection profile={profile} onEditPress={handleEditProfile} />;
      case 'transactions':
        return <TransactionsSection profile={profile} recentTransactions={recentTransactions} />;
      case 'quickActions':
        return (
          <QuickActionsSection
            quickAccessItems={quickAccessItems}
            isAdmin={isAdmin}
            hasSurveySubscription={hasSurveySubscription}
            onSubscriptionRequired={handleSubscriptionRequired}
            colors={colors}
          />
        );
      case 'rewards':
        return (
          <RewardsSectionBlock
            rewardSettings={rewardSettings}
            colors={colors}
          />
        );
      case 'settings':
        return (
          <SettingsSectionBlock
            securitySettings={securitySettings}
            appearanceSettings={appearanceSettings}
            colors={colors}
          />
        );
      case 'support':
        return <SupportSection colors={colors} />;
      case 'signOut':
        return <SignOutSection onSignOut={handleSignOut} colors={colors} />;
      default:
        return null;
    }
  }, [
    profile,
    colors,
    quickAccessItems,
    isAdmin,
    hasSurveySubscription,
    recentTransactions,
    rewardSettings,
    securitySettings,
    appearanceSettings,
    handleEditProfile,
    handleSubscriptionRequired,
    handleSignOut,
  ]);

  const keyExtractor = useCallback((item: SectionItem) => item.id, []);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  const isLoading = userLoading || statsLoading;

  if (isLoading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} animated />
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + SPACING.lg,
              paddingHorizontal: responsivePadding,
            },
          ]}
        >
          {/* Header during loading */}
          <View style={styles.loadingHeader}>
            <View>
              <AccessibleText variant="h1">Profile</AccessibleText>
              <AccessibleText variant="body" color="textMuted">
                Loading your account...
              </AccessibleText>
            </View>
          </View>
          <ProfileSkeleton />
        </View>
      </View>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} animated />

      {/* Top Header Bar — Settings (left) + Notification Bell (right) */}
      <Animated.View
        entering={FadeIn.reduceMotion(ReduceMotion.System)}
        style={[
          styles.notificationHeader,
          {
            paddingTop: insets.top + SPACING.sm,
            paddingHorizontal: responsivePadding,
          },
        ]}
      >
        <Pressable
          onPress={handleOpenQuickSettings}
          style={({ pressed }) => [
            styles.settingsButton,
            { backgroundColor: withAlpha(colors.text, pressed ? 0.12 : 0.06) },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Quick settings"
          accessibilityHint="Opens quick settings panel"
          hitSlop={6}
        >
          <Settings size={ICON_SIZE.lg} color={colors.text} strokeWidth={1.8} />
        </Pressable>
        <NotificationBell
          count={unreadCount ?? 0}
          onPress={() => router.push('/notifications' as Href)}
        />
      </Animated.View>

      {/* Main Content */}
      <FlatList
        ref={flatListRef}
        data={sections}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: SPACING.sm,
            paddingBottom: insets.bottom + SPACING['2xl'],
            paddingHorizontal: responsivePadding,
            maxWidth: layout.contentMaxWidth,
            alignSelf: 'center' as const,
            width: '100%',
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        // Performance optimizations — addresses VirtualizedList slow-update warning
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={100}
        windowSize={3}
        initialNumToRender={3}
      />

      {/* 2FA Verification Modal */}
      <OTPVerificationModal
        visible={show2FAModal}
        variant="enable2FA"
        maskedEmail={maskedEmail}
        expiresAt={otpExpiresAt}
        onVerify={handleVerify2FA}
        onResend={handleResend2FA}
        onClose={() => {
          // Don't allow dismiss while verification or resend is in-flight
          if (verify2FAMutation.isPending || resend2FAMutation.isPending) return;
          setShow2FAModal(false);
          setEnable2FAError(null);
          setMaskedEmail('');
          setOtpExpiresAt(null);
        }}
        isVerifying={verify2FAMutation.isPending}
        isResending={resend2FAMutation.isPending}
        error={enable2FAError}
      />

      {/* 2FA Disable Password Modal */}
      <Modal
        visible={showDisable2FAPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!updateTwoFactorMutation.isPending) {
            setShowDisable2FAPrompt(false);
            setDisable2FAPassword('');
          }
        }}
        statusBarTranslucent
        navigationBarTranslucent
        accessibilityViewIsModal
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <AccessibleText variant="h3" style={{ marginBottom: SPACING.sm }}>
              Disable 2FA
            </AccessibleText>
            <AccessibleText variant="body" color="textMuted" style={{ marginBottom: SPACING.md }}>
              Enter your password to confirm disabling two-factor authentication.
            </AccessibleText>
            <TextInput
              value={disable2FAPassword}
              onChangeText={setDisable2FAPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoFocus
              editable={!updateTwoFactorMutation.isPending}
              returnKeyType="done"
              onSubmitEditing={handleConfirmDisable2FA}
              style={[
                styles.passwordInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              accessibilityLabel="Password to disable two-factor authentication"
              accessibilityHint="Enter your account password to proceed"
            />
            <View style={styles.modalButtons}>
              <AnimatedCard
                variant="outlined"
                disabled={updateTwoFactorMutation.isPending}
                onPress={() => {
                  setShowDisable2FAPrompt(false);
                  setDisable2FAPassword('');
                }}
                style={{ flex: 1, marginRight: SPACING.sm, opacity: updateTwoFactorMutation.isPending ? 0.5 : 1 }}
              >
                <AccessibleText variant="body" style={{ textAlign: 'center' }}>Cancel</AccessibleText>
              </AnimatedCard>
              <AnimatedCard
                variant="filled"
                disabled={updateTwoFactorMutation.isPending}
                onPress={handleConfirmDisable2FA}
                style={{ flex: 1, opacity: updateTwoFactorMutation.isPending ? 0.7 : 1 }}
              >
                <AccessibleText variant="body" medium customColor="#FFFFFF" style={{ textAlign: 'center' }}>
                  {updateTwoFactorMutation.isPending ? 'Verifying...' : 'Disable'}
                </AccessibleText>
              </AnimatedCard>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2FA Disable OTP Verification Modal */}
      <OTPVerificationModal
        visible={showDisable2FAOTPModal}
        variant="disable2FA"
        title="Confirm Disable 2FA"
        subtitle="Enter the verification code to confirm disabling two-factor authentication"
        maskedEmail={disable2FAMaskedEmail}
        expiresAt={disable2FAOtpExpiresAt}
        onVerify={handleVerifyDisable2FA}
        onResend={handleResendDisable2FA}
        onClose={() => {
          setShowDisable2FAOTPModal(false);
          setDisable2FAPassword('');
          setDisable2FAError(null);
          setIsDisable2FAResending(false);
        }}
        isVerifying={updateTwoFactorMutation.isPending && !isDisable2FAResending}
        isResending={isDisable2FAResending}
        error={disable2FAError}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showChangePasswordModal}
        onChangePassword={handleConfirmChangePassword}
        onClose={() => {
          setShowChangePasswordModal(false);
          if (passwordChangeSucceeded.current) {
            passwordChangeSucceeded.current = false;
            showToast({ type: 'success', message: 'Password changed successfully!' });
          }
        }}
        isSaving={changePasswordMutation.isPending}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfileModal}
        user={editProfileUser}
        onSave={handleSaveProfile}
        onClose={() => setShowEditProfileModal(false)}
        isSaving={updateProfileMutation.isPending}
      />

      <RewardSettingsSheet
        visible={showRewardSettings}
        onClose={() => setShowRewardSettings(false)}
      />

      {/* Quick Settings Bottom Sheet */}
      <QuickSettingsSheet
        visible={showQuickSettings}
        onClose={() => setShowQuickSettings(false)}
        onViewAllSettings={handleScrollToSettings}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingHeader: {
    marginBottom: SPACING.xl,
  },
  listContent: {
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  supportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  supportIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportText: {
    flex: 1,
    gap: 2,
  },
  signOutSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  signOutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    padding: SPACING.xl,
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row' as const,
  },
});
