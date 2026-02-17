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

import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Modal,
  RefreshControl,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Href, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import {
  Gift,
  HelpCircle,
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
  TransactionsCard,
} from '@/components/profile';
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
  useUnreadCount,
  useUpdateProfile,
  useUpdateTwoFactor,
  useUserSessions,
  useUserStats,
  useVerify2FACode,
} from '@/services/hooks';
import { useSurveySubscriptionStatus } from '@/services/surveyPaymentHooks';
import { useAuth } from '@/utils/auth/useAuth';
import useUser from '@/utils/useUser';
import { UserRole } from '@/types';

// Theme
import {
  SPACING,
  ICON_SIZE,
  useTheme,
  useThemeStore,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// const SCREEN_HEIGHT = Dimensions.get('window').height; // unused for now

// Responsive helpers
const isTablet = SCREEN_WIDTH >= 768;
const isSmallScreen = SCREEN_WIDTH < 375;

const getResponsivePadding = () => {
  if (isTablet) return 32;
  if (isSmallScreen) return 16;
  return 20;
};

// Section types for FlatList
type SectionType =
  | 'header'
  | 'transactions'
  | 'quickActions'
  | 'achievements'
  | 'recentActivity'
  | 'settings'
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
  achievements: 0,    // not currently rendered
  recentActivity: 0,  // not currently rendered
  settings: 500,
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
        totalEarnings={profile.totalEarnings}
        walletBalance={profile.walletBalance}
        streakDays={profile.streakDays}
        maxStreak={30}
        onEditPress={onEditPress}
        onAvatarPress={() => Alert.alert('Change Photo', 'Photo picker coming soon!')}
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
  const { colors, statusBarStyle, isDark } = useTheme();
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const { signOut } = useAuth();
  
  // Data fetching
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { data: unreadCount, refetch: refetchUnread } = useUnreadCount();
  const { data: userStats, isLoading: statsLoading, refetch: refetchStats } = useUserStats();
  const { data: sessions = [], refetch: refetchSessions } = useUserSessions();
  const { data: surveySubscription, refetch: refetchSubscription } = useSurveySubscriptionStatus();
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
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subscription status
  const hasSurveySubscription = surveySubscription?.hasActiveSubscription ?? false;

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

  const responsivePadding = getResponsivePadding();

  // Profile data
  const profile = useMemo(() => ({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    walletBalance: user?.walletBalance ?? 0,
    totalEarnings: user?.totalEarnings || userStats?.totalEarnings || 0,
    totalRewards: user?.totalRewards || userStats?.totalRewards || 0,
    streakDays: userStats?.currentStreak || 0,
    isVerified: Boolean(user?.email),
    activeSessions: sessions.filter(s => s.isActive).length,
  }), [user, userStats, sessions]);

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
          onPress: () => router.push('/survey-payment' as Href),
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
    avatarUri: user?.avatar || undefined,
  }), [profile.firstName, profile.lastName, profile.email, profile.telephone, user?.avatar]);

  const handleEditProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEditProfileModal(true);
  }, []);

  const handleSaveProfile = useCallback(async (data: EditProfileData) => {
    try {
      // Map telephone (UI field name) to phone (API/Prisma field name)
      await updateProfileMutation.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.telephone,
      } as any);
      await refetchUser();
      setShowEditProfileModal(false);
      Alert.alert('Success', 'Your profile has been updated!');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile. Please try again.');
      throw error;
    }
  }, [updateProfileMutation, refetchUser]);

  const handleToggle2FA = useCallback(() => {
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
            Alert.alert('Error', error.message || 'Failed to send verification code.');
          },
        }
      );
    }
  }, [twoFactorEnabled, updateTwoFactorMutation]);

  const handleConfirmDisable2FA = useCallback(() => {
    if (!disable2FAPassword.trim()) {
      Alert.alert('Error', 'Password is required to disable 2FA.');
      return;
    }
    updateTwoFactorMutation.mutate(
      { enabled: false, password: disable2FAPassword },
      {
        onSuccess: () => {
          setTwoFactorEnabled(false);
          setShowDisable2FAPrompt(false);
          setDisable2FAPassword('');
          Alert.alert('2FA Disabled', 'Two-factor authentication has been disabled.');
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to disable 2FA.');
        },
      }
    );
  }, [disable2FAPassword, updateTwoFactorMutation]);

  const handleVerify2FA = useCallback((code: string) => {
    verify2FAMutation.mutate(code, {
      onSuccess: () => {
        setTwoFactorEnabled(true);
        setShow2FAModal(false);
        Alert.alert('2FA Enabled', 'Two-factor authentication is now active.');
      },
      onError: (error) => {
        Alert.alert('Verification Failed', error.message || 'Invalid verification code.');
      },
    });
  }, [verify2FAMutation]);

  const handleResend2FA = useCallback(() => {
    resend2FAMutation.mutate(undefined, {
      onSuccess: (data) => {
        setMaskedEmail(data.email || '');
        const expiresIn = data.expiresIn || 180;
        setOtpExpiresAt(Date.now() + expiresIn * 1000);
        Alert.alert('Code Resent', `A new verification code has been sent to ${data.email}`);
      },
      onError: (error) => {
        Alert.alert('Error', error.message || 'Failed to resend verification code.');
      },
    });
  }, [resend2FAMutation]);

  const handleChangePassword = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt('Current Password', 'Enter your current password:', (currentPassword) => {
        if (!currentPassword) return;
        Alert.prompt('New Password', 'Enter your new password (min 8 characters):', (newPassword) => {
          if (!newPassword || newPassword.length < 8) {
            Alert.alert('Error', 'New password must be at least 8 characters.');
            return;
          }
          changePasswordMutation.mutate(
            { currentPassword, newPassword },
            {
              onSuccess: () => Alert.alert('Success', 'Password changed successfully!'),
              onError: (e) => Alert.alert('Error', e.message || 'Failed to change password.'),
            }
          );
        }, 'secure-text');
      }, 'secure-text');
    } else {
      // Android: Alert.prompt not available — guide to forgot-password flow
      Alert.alert(
        'Change Password',
        'To change your password on Android, use the "Forgot Password" option on the sign-in screen.',
        [{ text: 'OK' }]
      );
    }
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

  // ============================================================================
  // SETTINGS ITEMS
  // ============================================================================

  const securitySettings: SettingItem[] = useMemo(() => [
    {
      type: 'toggle',
      id: '2fa',
      label: 'Two-Factor Authentication',
      subtitle: 'OTP required at sign-in',
      icon: <Shield size={ICON_SIZE.base} color={colors.primary} />,
      value: twoFactorEnabled,
      onChange: handleToggle2FA,
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
  ], [twoFactorEnabled, handleToggle2FA, handleChangePassword, handleManageSessions, colors, profile.activeSessions]);

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
      badge: 'Coming Soon',
      badgeColor: colors.warning,
    },
  ], [isDark, colors, toggleTheme]);

  // ============================================================================
  // FLAT LIST SECTIONS
  // ============================================================================

  const sections: SectionItem[] = useMemo(() => [
    { type: 'header', id: 'header' },
    { type: 'transactions', id: 'transactions' },
    { type: 'quickActions', id: 'quickActions' },
    { type: 'settings', id: 'settings' },
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
      case 'settings':
        return (
          <SettingsSectionBlock
            securitySettings={securitySettings}
            appearanceSettings={appearanceSettings}
            colors={colors}
          />
        );
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
        <StatusBar style={statusBarStyle} />
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
      <StatusBar style={statusBarStyle} />

      {/* Notification Bell Header */}
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
        <View />
        <NotificationBell
          count={unreadCount ?? 0}
          onPress={() => router.push('/notifications' as Href)}
        />
      </Animated.View>

      {/* Main Content */}
      <FlatList
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
        onClose={() => setShow2FAModal(false)}
        isVerifying={verify2FAMutation.isPending}
        isResending={resend2FAMutation.isPending}
      />

      {/* 2FA Disable Password Modal */}
      <Modal
        visible={showDisable2FAPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisable2FAPrompt(false)}
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
              style={[
                styles.passwordInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              accessibilityLabel="Password input"
            />
            <View style={styles.modalButtons}>
              <AnimatedCard
                variant="outlined"
                onPress={() => {
                  setShowDisable2FAPrompt(false);
                  setDisable2FAPassword('');
                }}
                style={{ flex: 1, marginRight: SPACING.sm }}
              >
                <AccessibleText variant="body" style={{ textAlign: 'center' }}>Cancel</AccessibleText>
              </AnimatedCard>
              <AnimatedCard
                variant="filled"
                onPress={handleConfirmDisable2FA}
                style={{ flex: 1 }}
              >
                <AccessibleText variant="body" medium customColor="#FFFFFF" style={{ textAlign: 'center' }}>
                  {updateTwoFactorMutation.isPending ? 'Disabling...' : 'Disable'}
                </AccessibleText>
              </AnimatedCard>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfileModal}
        user={editProfileUser}
        onSave={handleSaveProfile}
        onClose={() => setShowEditProfileModal(false)}
        isSaving={updateProfileMutation.isPending}
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
  loadingHeader: {
    marginBottom: SPACING.xl,
  },
  listContent: {
    flexGrow: 1,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
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
