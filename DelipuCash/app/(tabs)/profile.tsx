/**
 * Profile Screen - Redesigned
 * Clean, responsive UI following design system
 * Quick Access section with Help Support, My Rewards, Create Ad, Create Question cards
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Pressable,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  ChevronRight,
  CreditCard,
  Edit,
  Eye,
  Gift,
  Globe,
  HelpCircle,
  History,
  KeyRound,
  LogOut,
  LucideIcon,
  Megaphone,
  MessageSquare,
  Moon,
  Palette,
  PlusCircle,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  TrendingUp,
  Upload,
  Wallet,
  Zap,
} from 'lucide-react-native';

import { FormInput, NotificationBell, PrimaryButton, SectionHeader } from '@/components';
import {
  useChangePassword,
  useResend2FACode,
  useRevokeSession,
  useUnreadCount,
  useUpdatePrivacySettings,
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
import {
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  ThemeColors,
  TYPOGRAPHY,
  useTheme,
  useThemeStore,
  withAlpha,
} from '@/utils/theme';

const { width, height } = Dimensions.get('window');

// Platform-specific constants for industry-standard responsive design
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';
const isWeb = Platform.OS === 'web';

// Screen size breakpoints (following Material Design & iOS HIG guidelines)
const isTablet = width >= 768;
const isLargeScreen = width >= 1024;
const isSmallScreen = width < 375;
const isLandscape = width > height;

// Platform-aware responsive helpers
const getResponsiveSize = (small: number, medium: number, large: number) => {
  if (isLargeScreen) return large;
  if (isTablet) return medium;
  return small;
};

const getResponsivePadding = () => {
  // iOS typically uses more generous padding
  const basePadding = isIOS ? 2 : 0;
  // Adjust padding for landscape and web
  const landscapeAdjust = isLandscape ? 8 : 0;
  const webAdjust = isWeb ? 4 : 0;

  if (isLargeScreen) return 32 + basePadding + webAdjust;
  if (isTablet) return 24 + basePadding + landscapeAdjust;
  if (isSmallScreen) return 16;
  return 20 + basePadding;
};

// Platform-specific shadow styles (Android uses elevation, iOS uses shadow properties)
const getPlatformShadow = (elevation: number = 4) => {
  if (isAndroid) {
    return { elevation };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: elevation / 2 },
    shadowOpacity: 0.1 + elevation * 0.02,
    shadowRadius: elevation,
  };
};

// Platform-specific hit slop for touch targets (following platform guidelines)
const getHitSlop = () => ({
  top: isIOS ? 10 : 8,
  bottom: isIOS ? 10 : 8,
  left: isIOS ? 10 : 8,
  right: isIOS ? 10 : 8,
});

// Interface definitions
interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  walletBalance: number;
  totalEarnings: number;
  totalRewards: number;
  twoFactorEnabled: boolean;
  activeSessions: number;
}

interface QuickAccessItem {
  id: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  route?: string;
  onPress?: () => void;
  badge?: number;
  adminOnly?: boolean;
  /** If true, requires subscription for non-admin users */
  requiresSubscription?: boolean;
  /** Description shown below title (e.g., subscription status) */
  description?: string;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Quick Access Card Component
const QuickAccessCard = memo<{
  item: QuickAccessItem;
  index: number;
  colors: ThemeColors;
  isAdmin?: boolean;
  hasSubscription?: boolean;
  onSubscriptionRequired?: () => void;
}>(({ item, index, colors, isAdmin, hasSubscription, onSubscriptionRequired }) => {
  const scale = useSharedValue(1);
  const Icon = item.icon;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Skip if admin only and not admin
  if (item.adminOnly && !isAdmin) return null;

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if subscription is required for non-admin users
    if (item.requiresSubscription && !isAdmin && !hasSubscription) {
      onSubscriptionRequired?.();
      return;
    }

    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as Href);
    }
  };

  return (
    <View style={styles.quickAccessCardWrapper}>
      <Animated.View
        entering={FadeInDown.delay(100 + index * 50).springify()}
        style={{ flex: 1 }}
      >
        <AnimatedPressable
          style={[
            styles.quickAccessCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            getPlatformShadow(2),
            animatedStyle,
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          hitSlop={getHitSlop()}
          accessibilityLabel={item.title}
          accessibilityRole="button"
        >
          <View style={[styles.quickAccessIcon, { backgroundColor: item.iconBgColor }]}>
            <Icon size={ICON_SIZE.lg} color={item.iconColor} strokeWidth={1.5} />
            {item.badge !== undefined && item.badge > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.quickAccessText, { color: colors.text }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {item.title}
          </Text>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
});

QuickAccessCard.displayName = 'QuickAccessCard';

// Menu Item Component
const MenuItemComponent = memo<{
  item: MenuItem;
  isLast: boolean;
  colors: ThemeColors;
}>(({ item, isLast, colors }) => {
  const Icon = item.icon;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.menuItem,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        animatedStyle,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View style={[styles.menuItemIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
        <Icon size={ICON_SIZE.base} color={colors.primary} strokeWidth={1.5} />
      </View>
      <View style={styles.menuItemContent}>
        <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
        {item.subtitle && (
          <Text style={[styles.menuItemSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
        )}
      </View>
      <View style={[styles.menuItemArrow, { backgroundColor: colors.secondary }]}>
        <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={2} />
      </View>
    </AnimatedPressable>
  );
});

MenuItemComponent.displayName = 'MenuItemComponent';

// Stat Card Component
const StatCard = memo<{
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  colors: ThemeColors;
  delay?: number;
}>(({ label, value, icon: Icon, color, colors, delay = 0 }) => (
  <Animated.View
    entering={FadeInUp.delay(delay).springify()}
    style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    accessibilityLabel={`${label}: ${value}`}
  >
    <View style={[styles.statIconContainer, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Icon size={ICON_SIZE.md} color={color} strokeWidth={1.5} />
    </View>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    <Text style={[styles.statValue, { color: colors.text }]}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </Text>
  </Animated.View>
));

StatCard.displayName = 'StatCard';

// Loading Skeleton Component
const ProfileSkeleton = memo<{ colors: ThemeColors }>(({ colors }) => (
  <View style={styles.skeletonContainer}>
    <View style={[styles.skeletonCard, { backgroundColor: colors.card }]}>
      <View style={[styles.skeletonAvatar, { backgroundColor: colors.border }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '40%' }]} />
    </View>
    <View style={[styles.skeletonCard, { backgroundColor: colors.card }]}>
      <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '80%' }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: '60%' }]} />
    </View>
  </View>
));

ProfileSkeleton.displayName = 'ProfileSkeleton';

// Main Profile Screen
export default function ProfileScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { signOut } = useAuth();
  const { data: user, loading: userLoading, refetch: refetchUser } = useUser();
  const { data: unreadCount } = useUnreadCount();
  const { data: userStats, isLoading: statsLoading } = useUserStats();
  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useUserSessions();

  // Survey subscription status for non-admin users
  const { data: surveySubscription } = useSurveySubscriptionStatus();
  const hasSurveySubscription = surveySubscription?.hasActiveSubscription ?? false;

  // Mutations
  const updateProfileMutation = useUpdateProfile();
  const updateTwoFactorMutation = useUpdateTwoFactor();
  const verify2FAMutation = useVerify2FACode();
  const resend2FAMutation = useResend2FACode();
  const changePasswordMutation = useChangePassword();
  const updatePrivacyMutation = useUpdatePrivacySettings();
  const revokeSessionMutation = useRevokeSession();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(user?.twoFactorEnabled));
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);
  const [changePassword, setChangePassword] = useState({ current: '', next: '', confirm: '' });
  const [privacy, setPrivacy] = useState({ shareProfile: true, shareActivity: false });
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'security' | 'payments' | 'preferences'>('shortcuts');
  const [isEditing, setIsEditing] = useState(false);

  // Theme store for dark/light mode toggle
  const { isDark, toggleTheme } = useThemeStore();

  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || 'John',
    lastName: user?.lastName || 'Doe',
    email: user?.email || 'user@example.com',
    telephone: user?.telephone || '+256 XXX XXX XXX',
  });

  // Update form when user data loads
  React.useEffect(() => {
    if (user) {
      setEditForm({
        firstName: user.firstName || 'John',
        lastName: user.lastName || 'Doe',
        email: user.email || 'user@example.com',
        telephone: user.telephone || '+256 XXX XXX XXX',
      });
      setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
    }
  }, [user]);

  // OTP countdown timer effect
  useEffect(() => {
    if (show2FAModal && otpExpiresAt) {
      // Clear any existing interval
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      // Start countdown
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
        setOtpCountdown(remaining);

        if (remaining <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
    }
  }, [show2FAModal, otpExpiresAt]);

  // Cleanup countdown on modal close
  useEffect(() => {
    if (!show2FAModal) {
      setOtpExpiresAt(null);
      setOtpCountdown(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [show2FAModal]);

  const responsivePadding = getResponsivePadding();

  // Check if user is admin - using proper role-based check
  const isAdmin = useMemo(() => {
    return user?.role === UserRole.ADMIN || user?.role === UserRole.MODERATOR;
  }, [user?.role]);

  // Derive active sessions count from API data
  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.isActive).length;
  }, [sessions]);

  // Format sessions for display
  const formattedSessions = useMemo(() => {
    return sessions.filter(s => s.isActive).map(session => {
      const deviceInfo = session.deviceInfo as Record<string, string> | null;
      const device = deviceInfo?.model || deviceInfo?.platform || 'Unknown Device';
      const location = session.location || 'Unknown';

      // Calculate relative time
      const lastActivity = new Date(session.lastActivity);
      const now = new Date();
      const diffMs = now.getTime() - lastActivity.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let lastActive = 'Just now';
      if (diffDays > 0) lastActive = `${diffDays}d ago`;
      else if (diffHours > 0) lastActive = `${diffHours}h ago`;
      else if (diffMins > 0) lastActive = `${diffMins}m ago`;

      return {
        id: session.id,
        device,
        location,
        lastActive,
      };
    });
  }, [sessions]);

  const profile: ProfileData = {
    firstName: user?.firstName || 'John',
    lastName: user?.lastName || 'Doe',
    email: user?.email || 'user@example.com',
    telephone: user?.telephone || '+256 XXX XXX XXX',
    walletBalance: user?.walletBalance || userStats?.totalEarnings ? (userStats?.totalEarnings || 0) * 0.5 : 12404.44,
    totalEarnings: user?.totalEarnings || userStats?.totalEarnings || 24880.0,
    totalRewards: user?.totalRewards || userStats?.totalRewards || 1240.0,
    twoFactorEnabled,
    activeSessions,
  };

  // Quick Access Items - including Help Support, My Rewards, Create Ad, Create Question
  const quickAccessItems: QuickAccessItem[] = useMemo(
    () => [
      {
        id: 'rewards',
        title: 'My Rewards',
        icon: Gift,
        iconColor: '#FFC107',
        iconBgColor: 'rgba(255, 193, 7, 0.1)',
        onPress: () => {
          Alert.alert('My Rewards', 'View and claim your earned rewards here!');
        },
      },
      {
        id: 'help-support',
        title: 'Help & Support',
        icon: HelpCircle,
        iconColor: '#2196F3',
        iconBgColor: 'rgba(33, 150, 243, 0.1)',
        route: '/help-support',
      },
      {
        id: 'surveys',
        title: 'My Surveys',
        icon: MessageSquare,
        iconColor: '#007B55',
        iconBgColor: 'rgba(0, 123, 85, 0.1)',
        route: '/(tabs)/surveys',
      },
      {
        id: 'transactions',
        title: 'Transactions',
        icon: History,
        iconColor: '#9C27B0',
        iconBgColor: 'rgba(156, 39, 176, 0.1)',
        route: '/(tabs)/transactions',
      },
      {
        id: 'create-ad',
        title: 'Create Ad',
        icon: Megaphone,
        iconColor: '#FF5722',
        iconBgColor: 'rgba(255, 87, 34, 0.1)',
        route: '/ad-registration',
        adminOnly: true,
      },
      {
        id: 'create-instant-reward',
        title: 'Create Instant Reward',
        icon: Sparkles,
        iconColor: '#FFC107',
        iconBgColor: 'rgba(255, 193, 7, 0.1)',
        route: '/instant-reward-upload',
        adminOnly: true,
      },
      {
        id: 'upload-questions-file',
        title: 'Upload Questions via File',
        icon: Upload,
        iconColor: '#2196F3',
        iconBgColor: 'rgba(33, 150, 243, 0.1)',
        route: '/file-upload',
        adminOnly: true,
      },
      {
        id: 'create-survey',
        title: 'Create Survey',
        icon: PlusCircle,
        iconColor: '#FF9800',
        iconBgColor: 'rgba(255, 152, 0, 0.1)',
        route: '/create-survey',
        // Visible to all users but requires subscription for non-admins
        requiresSubscription: true,
      },
    ],
    []
  );

  const tabs = [
    { key: 'shortcuts', label: 'Shortcuts', icon: Zap },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'preferences', label: 'Preferences', icon: Settings },
  ] as const;

  // Handler for subscription required (shown when non-admin users try to access subscription features)
  const handleSubscriptionRequired = useCallback((): void => {
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

  // Handlers
  const handleSignOut = useCallback((): void => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  const handleWithdraw = useCallback((): void => {
    if (profile.walletBalance <= 0) {
      Alert.alert('Insufficient funds', 'You need a positive balance to withdraw.');
      return;
    }
    router.push('/(tabs)/withdraw');
  }, [profile.walletBalance]);

  const handleChangePassword = useCallback((): void => {
    if (!changePassword.current || !changePassword.next || !changePassword.confirm) {
      Alert.alert('Missing fields', 'Please fill all password fields.');
      return;
    }
    if (changePassword.next.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (changePassword.next !== changePassword.confirm) {
      Alert.alert('Mismatch', 'New passwords do not match.');
      return;
    }

    changePasswordMutation.mutate(
      { currentPassword: changePassword.current, newPassword: changePassword.next },
      {
        onSuccess: () => {
          Alert.alert('Password updated', 'Your password has been changed.');
          setChangePassword({ current: '', next: '', confirm: '' });
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to change password.');
        },
      }
    );
  }, [changePassword, changePasswordMutation]);

  const toggleTwoFactor = useCallback((): void => {
    if (twoFactorEnabled) {
      // Disabling 2FA - show password modal
      setShowDisable2FAModal(true);
    } else {
      // Enabling 2FA - request verification code
      updateTwoFactorMutation.mutate(
        { enabled: true },
        {
          onSuccess: (data) => {
            if (data.codeSent) {
              // Code sent successfully, show OTP verification modal
              setMaskedEmail(data.email || '');
              setOtpCode('');
              // Set expiry time (3 minutes = 180 seconds)
              const expiresIn = data.expiresIn || 180;
              setOtpExpiresAt(Date.now() + expiresIn * 1000);
              setOtpCountdown(expiresIn);
              setShow2FAModal(true);
            } else if (data.enabled) {
              // 2FA was already enabled
              setTwoFactorEnabled(true);
              Alert.alert('Two-factor authentication', '2FA is already enabled.');
            }
          },
          onError: (error) => {
            Alert.alert('Error', error.message || 'Failed to send verification code.');
          },
        }
      );
    }
  }, [twoFactorEnabled, updateTwoFactorMutation]);

  // Handle OTP verification to complete enabling 2FA
  const handleVerify2FA = useCallback((): void => {
    if (otpCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code.');
      return;
    }

    // Check if OTP has expired
    if (otpExpiresAt && Date.now() > otpExpiresAt) {
      Alert.alert('Code Expired', 'Your verification code has expired. Please request a new one.');
      return;
    }

    verify2FAMutation.mutate(otpCode, {
      onSuccess: () => {
        setTwoFactorEnabled(true);
        setShow2FAModal(false);
        setOtpCode('');
        setOtpExpiresAt(null);
        setOtpCountdown(0);
        Alert.alert(
          'Two-factor authentication enabled',
          '2FA (OTP) is now active. Codes will be required at sign-in.'
        );
      },
      onError: (error) => {
        Alert.alert('Verification Failed', error.message || 'Invalid verification code.');
      },
    });
  }, [otpCode, otpExpiresAt, verify2FAMutation]);

  // Handle resend 2FA code
  const handleResend2FACode = useCallback((): void => {
    resend2FAMutation.mutate(undefined, {
      onSuccess: (data) => {
        setMaskedEmail(data.email || '');
        // Reset expiry time (3 minutes = 180 seconds)
        const expiresIn = data.expiresIn || 180;
        setOtpExpiresAt(Date.now() + expiresIn * 1000);
        setOtpCountdown(expiresIn);
        setOtpCode('');
        Alert.alert('Code Resent', `A new verification code has been sent to ${data.email}`);
      },
      onError: (error) => {
        Alert.alert('Error', error.message || 'Failed to resend verification code.');
      },
    });
  }, [resend2FAMutation]);

  // Handle disable 2FA with password verification
  const handleDisable2FA = useCallback((): void => {
    if (!disablePassword) {
      Alert.alert('Password Required', 'Please enter your password to disable 2FA.');
      return;
    }

    updateTwoFactorMutation.mutate(
      { enabled: false, password: disablePassword },
      {
        onSuccess: () => {
          setTwoFactorEnabled(false);
          setShowDisable2FAModal(false);
          setDisablePassword('');
          Alert.alert(
            'Two-factor authentication disabled',
            '2FA has been disabled. Re-enable to secure your account.'
          );
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to disable 2FA. Check your password.');
        },
      }
    );
  }, [disablePassword, updateTwoFactorMutation]);

  const handleRevokeSession = useCallback((id: string): void => {
    Alert.alert(
      'Revoke Session',
      'Are you sure you want to sign out this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            revokeSessionMutation.mutate(id, {
              onSuccess: () => {
                refetchSessions();
                Alert.alert('Session signed out', 'Selected session has been revoked.');
              },
              onError: (error) => {
                Alert.alert('Error', error.message || 'Failed to revoke session.');
              },
            });
          },
        },
      ]
    );
  }, [revokeSessionMutation, refetchSessions]);

  const handleTogglePrivacy = useCallback((key: keyof typeof privacy): void => {
    const newSettings = { ...privacy, [key]: !privacy[key] };

    updatePrivacyMutation.mutate(newSettings, {
      onSuccess: () => {
        setPrivacy(newSettings);
      },
      onError: (error) => {
        Alert.alert('Error', error.message || 'Failed to update privacy settings.');
      },
    });
  }, [privacy, updatePrivacyMutation]);

  const handleSaveProfile = useCallback(async (): Promise<void> => {
    updateProfileMutation.mutate(
      {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        // Note: Email and phone updates may require verification in production
      },
      {
        onSuccess: () => {
          refetchUser();
          Alert.alert('Success', 'Profile updated successfully!', [
            { text: 'OK', onPress: () => setIsEditing(false) },
          ]);
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to update profile. Please try again.');
        },
      }
    );
  }, [editForm, updateProfileMutation, refetchUser]);

  const handleCancelEdit = useCallback((): void => {
    setEditForm({
      firstName: user?.firstName || 'John',
      lastName: user?.lastName || 'Doe',
      email: user?.email || 'user@example.com',
      telephone: user?.telephone || '+256 XXX XXX XXX',
    });
    setIsEditing(false);
  }, [user]);

  // Quick actions for shortcuts tab
  const quickActions = useMemo<MenuItem[]>(
    () => [
      {
        icon: Edit,
        label: 'Edit profile',
        subtitle: 'Update personal details',
        onPress: () => setIsEditing(true),
      },
      {
        icon: Wallet,
        label: 'Wallet',
        subtitle: 'Balance & withdraw',
        onPress: handleWithdraw,
      },
      {
        icon: History,
        label: 'Transactions',
        subtitle: 'View history',
        onPress: () => router.push('/(tabs)/transactions'),
      },
    ],
    [handleWithdraw]
  );

  // Payment items
  const paymentItems: MenuItem[] = useMemo(
    () => [
      {
        icon: CreditCard,
        label: 'Mobile Money',
        subtitle: 'Link your mobile money',
        onPress: () => Alert.alert('Mobile Money', 'Link your mobile money account for payments.'),
      },
      {
        icon: Wallet,
        label: 'Wallet balance',
        subtitle: `$${profile.walletBalance.toFixed(2)}`,
        onPress: () => router.push('/(tabs)/withdraw'),
      },
      {
        icon: ArrowUpRight,
        label: 'Withdraw',
        subtitle: 'Send to mobile money',
        onPress: handleWithdraw,
      },
    ],
    [profile.walletBalance, handleWithdraw]
  );

  // Show loading state
  const isLoading = userLoading || statsLoading;

  // Show loading skeleton during initial load
  if (isLoading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={statusBarStyle} />
        <View style={[styles.scrollContent, { paddingTop: insets.top + SPACING.lg, paddingHorizontal: responsivePadding }]}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Loading your account...
                </Text>
              </View>
            </View>
          </View>
          <ProfileSkeleton colors={colors} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING['2xl'],
            paddingHorizontal: responsivePadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                Manage your account
              </Text>
            </View>
            <NotificationBell count={unreadCount ?? 0} onPress={() => router.push('/notifications' as Href)} />
          </View>
        </Animated.View>

        {/* Personal Information Card - First Section */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[styles.personalInfoCard, { backgroundColor: colors.card, borderColor: colors.border }, getPlatformShadow(3)]}
        >
          {/* Card Header */}
          <View style={styles.personalInfoHeader}>
            <View style={styles.personalInfoTitleRow}>
              <View style={[styles.personalInfoIconBg, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <BadgeCheck size={ICON_SIZE.base} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.personalInfoTitleText}>
                <Text style={[styles.personalInfoTitle, { color: colors.text }]}>Personal Information</Text>
                <Text style={[styles.personalInfoSubtitle, { color: colors.textMuted }]}>
                  {isEditing ? 'Update your details below' : 'Your account details'}
                </Text>
              </View>
            </View>
            {!isEditing ? (
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: withAlpha(colors.primary, 0.1) }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditing(true);
                }}
                accessibilityLabel="Edit profile"
                accessibilityRole="button"
              >
                <Edit size={ICON_SIZE.sm} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
                <View style={styles.editHeaderActions}>
                <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                    onPress={handleCancelEdit}
                >
                    <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

          {/* Profile Content */}
          <View style={styles.profileContent}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={[colors.primary, withAlpha(colors.primary, 0.7)]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitials}>
                    {(isEditing ? editForm.firstName : profile.firstName).charAt(0).toUpperCase()}
                    {(isEditing ? editForm.lastName : profile.lastName).charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={[styles.verifiedIcon, { backgroundColor: colors.success, borderColor: colors.card }]}>
                  <ShieldCheck size={12} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>
              {!isEditing && (
                <View style={styles.avatarInfo}>
                  <Text style={[styles.avatarName, { color: colors.text }]}>
                    {profile.firstName} {profile.lastName}
                  </Text>
                  <View style={[styles.verifiedBadgeRow, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                    <BadgeCheck size={12} color={colors.success} strokeWidth={2} />
                    <Text style={[styles.verifiedText, { color: colors.success }]}>Verified Account</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Form / Details */}
            {isEditing ? (
              <View style={styles.editFormContainer}>
                <View style={styles.formRow}>
                  <View style={styles.formField}>
                    <FormInput
                      label="First Name"
                      value={editForm.firstName}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, firstName: text }))}
                      placeholder="Enter first name"
                    />
                  </View>
                  <View style={styles.formField}>
                    <FormInput
                      label="Last Name"
                      value={editForm.lastName}
                      onChangeText={(text) => setEditForm((prev) => ({ ...prev, lastName: text }))}
                      placeholder="Enter last name"
                    />
                  </View>
                </View>
                <FormInput
                  label="Email Address"
                  value={editForm.email}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, email: text }))}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormInput
                  label="Phone Number"
                  value={editForm.telephone}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, telephone: text }))}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
                <View style={styles.saveButtonContainer}>
                  <PrimaryButton
                    title="Save Changes"
                    onPress={handleSaveProfile}
                    size="medium"
                    variant="primary"
                  />
                </View>
              </View>
            ) : (
                <View style={styles.detailsContainer}>
                  {/* Email Row */}
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.detailIconContainer, { backgroundColor: withAlpha(colors.info, 0.1) }]}>
                      <MessageSquare size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Email</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                        {profile.email}
                      </Text>
                    </View>
                  </View>

                  {/* Phone Row */}
                  <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.detailIconContainer, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                      <Smartphone size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Phone</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>{profile.telephone}</Text>
                    </View>
                  </View>

                  {/* Sessions Row */}
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconContainer, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
                      <Shield size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
                    </View>
                    <View style={styles.detailContent}>
                      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Active Sessions</Text>
                      <Text style={[styles.detailValue, { color: colors.text }]}>
                        {profile.activeSessions} {profile.activeSessions === 1 ? 'device' : 'devices'}
                      </Text>
                    </View>
                  </View>
                </View>
            )}
          </View>
        </Animated.View>

        {/* Hero Card - Account Overview */}
        <Animated.View
          entering={FadeInDown.delay(150).springify()}
          style={[styles.heroCardWrapper, getPlatformShadow(8)]}
        >
          <LinearGradient
            colors={[colors.primary, withAlpha(colors.primary, 0.85)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Decorative Elements */}
            <View style={styles.heroDecorCircle1} />
            <View style={styles.heroDecorCircle2} />

            {/* Header Row */}
            <View style={styles.heroTopRow}>
              <View style={styles.heroIdentity}>
                <Text style={styles.heroWelcome}>Welcome back,</Text>
                <Text style={styles.heroTitle}>
                  {profile.firstName} {profile.lastName}
                </Text>
              </View>
              <View style={styles.heroBadge}>
                <ShieldCheck size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.heroBadgeText}>Verified</Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <View style={styles.heroStatIconWrapper}>
                  <Wallet size={16} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={styles.heroStatContent}>
                  <Text style={styles.heroStatLabel}>Wallet Balance</Text>
                  <Text style={styles.heroStatValue}>
                    ${profile.walletBalance.toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <View style={styles.heroStatIconWrapper}>
                  <TrendingUp size={16} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={styles.heroStatContent}>
                  <Text style={styles.heroStatLabel}>Total Earned</Text>
                  <Text style={styles.heroStatValue}>
                    ${profile.totalEarnings.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions Row */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity
                style={styles.heroActionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleWithdraw();
                }}
                activeOpacity={0.8}
              >
                <ArrowUpRight size={18} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.heroActionText, { color: colors.primary }]}>Withdraw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroActionButtonOutline}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/(tabs)/transactions');
                }}
                activeOpacity={0.8}
              >
                <History size={18} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.heroActionTextOutline}>History</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Access Section */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Quick Access"
            subtitle="Frequently used features"
            icon={<Sparkles size={ICON_SIZE.base} color={colors.primary} />}
          />
          <View style={styles.quickAccessGrid}>
            {quickAccessItems.map((item, index) => (
              <QuickAccessCard
                key={item.id}
                item={item}
                index={index}
                colors={colors}
                isAdmin={isAdmin}
                hasSubscription={hasSurveySubscription}
                onSubscriptionRequired={handleSubscriptionRequired}
              />
            ))}
          </View>
        </View>

        {/* Stats Cards Section */}
        <View style={styles.statsSection}>
          <SectionHeader
            title="Account Overview"
            subtitle="Your earnings and balance"
            icon={<TrendingUp size={ICON_SIZE.base} color={colors.success} />}
          />
          <View style={styles.statsGrid}>
            <StatCard
              label="Wallet"
              value={`$${profile.walletBalance.toLocaleString()}`}
              icon={Wallet}
              color={colors.primary}
              colors={colors}
              delay={200}
            />
            <StatCard
              label="Earnings"
              value={`$${profile.totalEarnings.toLocaleString()}`}
              icon={TrendingUp}
              color={colors.success}
              colors={colors}
              delay={250}
            />
            <StatCard
              label="Rewards"
              value={`$${profile.totalRewards.toLocaleString()}`}
              icon={Gift}
              color={colors.warning}
              colors={colors}
              delay={300}
            />
            <StatCard
              label="Sessions"
              value={profile.activeSessions}
              icon={Smartphone}
              color={colors.info}
              colors={colors}
              delay={350}
            />
          </View>
        </View>

        {/* Tab Navigation */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.tabsContainer}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tabButton,
                  { backgroundColor: isActive ? withAlpha(colors.primary, 0.12) : withAlpha(colors.text, 0.05) },
                  { borderWidth: 1, borderColor: isActive ? withAlpha(colors.primary, 0.2) : withAlpha(colors.border, 0.5) },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <View style={[styles.tabIconContainer, isActive ? { backgroundColor: colors.primary } : { backgroundColor: withAlpha(colors.textMuted, 0.12) }]}>
                  <Icon size={ICON_SIZE.sm} color={isActive ? '#FFFFFF' : colors.text} strokeWidth={2} />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.primary : colors.text },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[styles.tabIndicator, { backgroundColor: colors.primary }]}
                  />
                )}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Tab Content */}
        {activeTab === 'shortcuts' && (
          <Animated.View entering={FadeInDown.springify()}>
            <SectionHeader
              title="Quick Actions"
              subtitle="Frequently used features"
              icon={<Zap size={ICON_SIZE.base} color={colors.primary} />}
            />
            <Animated.View
              entering={FadeInUp.delay(100).springify()}
              style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {quickActions.map((item, index) => (
                <MenuItemComponent
                  key={item.label}
                  item={item}
                  isLast={index === quickActions.length - 1}
                  colors={colors}
                />
              ))}
            </Animated.View>
          </Animated.View>
        )}

        {activeTab === 'security' && (
          <Animated.View entering={FadeInDown.springify()}>
            <SectionHeader
              title="Security & Privacy"
              subtitle="Protect your account"
              icon={<Shield size={ICON_SIZE.base} color={colors.success} />}
            />
            <Animated.View
              entering={FadeInUp.delay(100).springify()}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* 2FA Toggle */}
              <View style={[styles.securityRow, { borderColor: colors.border }]}>
                <View style={styles.securityText}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>Two-factor authentication</Text>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                    OTP required at sign-in to protect access.
                  </Text>
                </View>
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={toggleTwoFactor}
                  thumbColor={twoFactorEnabled ? colors.primary : colors.border}
                  trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
                />
              </View>

              {/* Change Password */}
              <View style={[styles.sectionBlock, { borderColor: colors.border }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <KeyRound size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Change password</Text>
                  </View>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                    Use a strong unique password.
                  </Text>
                </View>
                <View style={styles.formStack}>
                  <FormInput
                    label="Current password"
                    value={changePassword.current}
                    onChangeText={(text) => setChangePassword((prev) => ({ ...prev, current: text }))}
                    placeholder="Enter current password"
                    secureTextEntry
                  />
                  <FormInput
                    label="New password"
                    value={changePassword.next}
                    onChangeText={(text) => setChangePassword((prev) => ({ ...prev, next: text }))}
                    placeholder="At least 8 characters"
                    secureTextEntry
                  />
                  <FormInput
                    label="Confirm new password"
                    value={changePassword.confirm}
                    onChangeText={(text) => setChangePassword((prev) => ({ ...prev, confirm: text }))}
                    placeholder="Re-enter new password"
                    secureTextEntry
                  />
                  <PrimaryButton title="Update password" onPress={handleChangePassword} />
                </View>
              </View>

              {/* Privacy Controls */}
              <View style={[styles.sectionBlock, { borderColor: colors.border }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <Eye size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Privacy controls</Text>
                  </View>
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>Public profile</Text>
                  <Switch
                    value={privacy.shareProfile}
                    onValueChange={() => handleTogglePrivacy('shareProfile')}
                    thumbColor={privacy.shareProfile ? colors.primary : colors.border}
                    trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>Show activity</Text>
                  <Switch
                    value={privacy.shareActivity}
                    onValueChange={() => handleTogglePrivacy('shareActivity')}
                    thumbColor={privacy.shareActivity ? colors.primary : colors.border}
                    trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
                  />
                </View>
              </View>

              {/* Active Sessions */}
              <View style={[styles.sectionBlock, { borderColor: colors.border }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <Smartphone size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Active sessions</Text>
                  </View>
                  {sessionsLoading && (
                    <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>Loading...</Text>
                  )}
                </View>
                {formattedSessions.length === 0 && !sessionsLoading ? (
                  <View style={[styles.emptyState, { borderColor: colors.border }]}>
                    <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                      No active sessions found
                    </Text>
                  </View>
                ) : (
                  formattedSessions.map((session) => (
                    <View key={session.id} style={[styles.sessionItem, { borderColor: colors.border }]}>
                      <View style={styles.sessionText}>
                        <Text style={[styles.securityTitle, { color: colors.text }]}>{session.device}</Text>
                        <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                          {session.location} · {session.lastActive}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRevokeSession(session.id)}
                        disabled={revokeSessionMutation.isPending}
                      >
                        <Text style={[styles.sessionRevoke, { color: colors.error }]}>
                          {revokeSessionMutation.isPending ? 'Signing out...' : 'Sign out'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {activeTab === 'payments' && (
          <Animated.View entering={FadeInDown.springify()}>
            <SectionHeader
              title="Wallet & Payments"
              subtitle="Manage your money"
              icon={<CreditCard size={ICON_SIZE.base} color={colors.warning} />}
            />
            <Animated.View
              entering={FadeInUp.delay(100).springify()}
              style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {paymentItems.map((item, index) => (
                <MenuItemComponent
                  key={item.label}
                  item={item}
                  isLast={index === paymentItems.length - 1}
                  colors={colors}
                />
              ))}
            </Animated.View>
          </Animated.View>
        )}

        {activeTab === 'preferences' && (
          <Animated.View entering={FadeInDown.springify()}>
            <SectionHeader
              title="Preferences"
              subtitle="Customize your experience"
              icon={<Settings size={ICON_SIZE.base} color={colors.info} />}
            />
            <Animated.View
              entering={FadeInUp.delay(100).springify()}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Theme Toggle Section */}
              <View style={[styles.sectionBlock, { borderColor: colors.border }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <Palette size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Appearance</Text>
                  </View>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                    Choose your preferred theme for a comfortable viewing experience.
                  </Text>
                </View>

                {/* Dark/Light Mode Toggle */}
                <View style={[styles.themeToggleContainer, { borderColor: colors.border }]}>
                  <View style={styles.themeInfo}>
                    <View style={[styles.themeIconWrapper, { backgroundColor: withAlpha(isDark ? colors.primary : colors.warning, 0.12) }]}>
                      {isDark ? (
                        <Moon size={ICON_SIZE.base} color={colors.primary} />
                      ) : (
                        <Sun size={ICON_SIZE.base} color={colors.warning} />
                      )}
                    </View>
                    <View style={styles.themeLabelContainer}>
                      <Text style={[styles.securityTitle, { color: colors.text }]}>
                        {isDark ? 'Dark Mode' : 'Light Mode'}
                      </Text>
                      <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                        {isDark ? 'Easier on your eyes in low light' : 'Better visibility in bright environments'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isDark}
                    onValueChange={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleTheme();
                    }}
                    thumbColor={isDark ? colors.primary : colors.warning}
                    trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
                  />
                </View>

                {/* Theme Preview Cards */}
                <View style={styles.themePreviewRow}>
                  <Pressable
                    style={[
                      styles.themePreviewCard,
                      { backgroundColor: '#1A1A2E', borderColor: isDark ? colors.primary : colors.border },
                      isDark && styles.themePreviewCardActive,
                    ]}
                    onPress={() => {
                      if (!isDark) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        toggleTheme();
                      }
                    }}
                  >
                    <Moon size={ICON_SIZE.sm} color="#8B5CF6" />
                    <Text style={[styles.themePreviewLabel, { color: '#FFFFFF' }]}>Dark</Text>
                    {isDark && (
                      <View style={[styles.themeCheckmark, { backgroundColor: colors.primary }]}>
                        <BadgeCheck size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    style={[
                      styles.themePreviewCard,
                      { backgroundColor: '#F8F9FA', borderColor: !isDark ? colors.primary : colors.border },
                      !isDark && styles.themePreviewCardActive,
                    ]}
                    onPress={() => {
                      if (isDark) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        toggleTheme();
                      }
                    }}
                  >
                    <Sun size={ICON_SIZE.sm} color="#F59E0B" />
                    <Text style={[styles.themePreviewLabel, { color: '#1A1A2E' }]}>Light</Text>
                    {!isDark && (
                      <View style={[styles.themeCheckmark, { backgroundColor: colors.primary }]}>
                        <BadgeCheck size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Notification Preferences */}
              <View style={[styles.sectionBlock, { borderColor: colors.border }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <Bell size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Notifications</Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.preferenceItem, { borderColor: colors.border }]}
                  onPress={() => router.push('/notifications' as Href)}
                >
                  <View style={styles.preferenceItemContent}>
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Manage Notifications</Text>
                    <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                      Control push notifications and alerts
                    </Text>
                  </View>
                  <ChevronRight size={ICON_SIZE.base} color={colors.textMuted} />
                </Pressable>
              </View>

              {/* Language & Region */}
              <View style={[styles.sectionBlock, { borderColor: colors.border, borderBottomWidth: 0 }]}>
                <View style={styles.inlineHeader}>
                  <View style={styles.inlineTitleRow}>
                    <Globe size={ICON_SIZE.base} color={colors.text} />
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Language & Region</Text>
                  </View>
                </View>
                <View style={[styles.preferenceItem, { borderColor: colors.border, borderBottomWidth: 0 }]}>
                  <View style={styles.preferenceItemContent}>
                    <Text style={[styles.securityTitle, { color: colors.text }]}>Language</Text>
                    <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>
                      English (Default)
                    </Text>
                  </View>
                  <View style={[styles.comingSoonBadge, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
                    <Text style={[styles.comingSoonText, { color: colors.warning }]}>Coming Soon</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {/* Sign Out Button */}
        <Animated.View entering={FadeIn.delay(500)}>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              handleSignOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out of your account"
          >
            <View style={[styles.signOutIcon, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
              <LogOut size={ICON_SIZE.base} color={colors.error} strokeWidth={2} />
            </View>
            <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
            <ChevronRight size={ICON_SIZE.base} color={colors.error} strokeWidth={1.5} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Enable 2FA Modal - OTP Verification */}
      <Modal
        visible={show2FAModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShow2FAModal(false);
          setOtpCode('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalIconWrapper, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
              <Shield size={32} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Verify Your Email</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              We&apos;ve sent a 6-digit code to {maskedEmail}. Enter it below to enable two-factor authentication.
            </Text>

            {/* Countdown Timer */}
            <View style={[styles.countdownContainer, { backgroundColor: otpCountdown > 0 ? withAlpha(colors.primary, 0.1) : withAlpha(colors.error, 0.1) }]}>
              <Text style={[styles.countdownText, { color: otpCountdown > 0 ? colors.primary : colors.error }]}>
                {otpCountdown > 0
                  ? `Code expires in ${Math.floor(otpCountdown / 60)}:${(otpCountdown % 60).toString().padStart(2, '0')}`
                  : 'Code expired - please request a new one'}
              </Text>
            </View>

            <TextInput
              style={[
                styles.otpInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: otpCountdown > 0 ? colors.border : colors.error,
                },
              ]}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="Enter 6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={otpCountdown > 0}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShow2FAModal(false);
                  setOtpCode('');
                }}
              >
                <Text style={[styles.modalSecondaryButtonText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: otpCountdown > 0 ? colors.primary : colors.border },
                  (verify2FAMutation.isPending || otpCountdown <= 0) && { opacity: 0.7 },
                ]}
                onPress={handleVerify2FA}
                disabled={verify2FAMutation.isPending || otpCountdown <= 0}
              >
                {verify2FAMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResend2FACode}
              disabled={resend2FAMutation.isPending}
            >
              {resend2FAMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.resendButtonText, { color: colors.primary }]}>Resend Code</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Disable 2FA Modal - Password Verification */}
      <Modal
        visible={showDisable2FAModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDisable2FAModal(false);
          setDisablePassword('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalIconWrapper, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
              <KeyRound size={32} color={colors.warning} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Disable Two-Factor Authentication</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Enter your password to confirm disabling 2FA. This will make your account less secure.
            </Text>
            <TextInput
              style={[
                styles.otpInput,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={disablePassword}
              onChangeText={setDisablePassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalSecondaryButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowDisable2FAModal(false);
                  setDisablePassword('');
                }}
              >
                <Text style={[styles.modalSecondaryButtonText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: colors.warning },
                  updateTwoFactorMutation.isPending && { opacity: 0.7 },
                ]}
                onPress={handleDisable2FA}
                disabled={updateTwoFactorMutation.isPending}
              >
                {updateTwoFactorMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Disable 2FA</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.base,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: getResponsiveSize(TYPOGRAPHY.fontSize['3xl'], TYPOGRAPHY.fontSize['4xl'], TYPOGRAPHY.fontSize['5xl']),
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: 0.1,
  },
  // Hero Card Styles - Improved Design
  heroCardWrapper: {
    marginBottom: SPACING.lg,
    borderRadius: RADIUS['2xl'],
    // Shadow applied via getPlatformShadow() in component
  },
  heroCard: {
    borderRadius: RADIUS['2xl'],
    padding: SPACING.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroDecorCircle2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  heroIdentity: {
    flex: 1,
    marginRight: SPACING.md,
  },
  heroWelcome: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: getResponsiveSize(TYPOGRAPHY.fontSize.xl, TYPOGRAPHY.fontSize['2xl'], TYPOGRAPHY.fontSize['3xl']),
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroStatIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatContent: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: SPACING.md,
  },
  heroStatLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  heroStatValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: '#FFFFFF',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  heroActionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  heroActionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroActionTextOutline: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  heroGhostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  heroGhostText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.base,
    // Using negative margin trick for consistent gutters (industry standard approach)
    marginHorizontal: -SPACING.xs,
  },
  quickAccessCardWrapper: {
    // 2-column layout: each card takes exactly 50% width
    width: '50%',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  quickAccessCard: {
    width: '100%',
    aspectRatio: 1.1, // Slightly taller than wide for better visual balance
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    padding: SPACING.md,
    // Shadow for depth (platform-specific applied in component)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  quickAccessText: {
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.3,
    paddingHorizontal: SPACING.xs,
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  // Personal Information Card Styles
  personalInfoCard: {
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    // Shadow applied via getPlatformShadow() in component
    overflow: 'hidden',
  },
  personalInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  personalInfoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  personalInfoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  personalInfoTitleText: {
    flex: 1,
  },
  personalInfoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: 0.2,
  },
  personalInfoSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cancelButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cardDivider: {
    height: 1,
    marginHorizontal: SPACING.lg,
  },
  profileContent: {
    padding: SPACING.lg,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitials: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  verifiedIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  avatarName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    letterSpacing: 0.2,
    marginBottom: SPACING.xs,
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  editFormContainer: {
    gap: SPACING.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formField: {
    flex: 1,
  },
  saveButtonContainer: {
    marginTop: SPACING.sm,
  },
  detailsContainer: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  statsSection: {
    marginBottom: SPACING.lg,
  },
  // Legacy styles kept for compatibility
  profileCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: COMPONENT_SIZE.avatar.xl + 8,
    height: COMPONENT_SIZE.avatar.xl + 8,
    borderRadius: (COMPONENT_SIZE.avatar.xl + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  profileEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  profilePhone: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  editActionButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  editActionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  editForm: {
    gap: SPACING.md,
  },
  nameInputs: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  nameInput: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    minWidth: '45%',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  tabButtonActive: {
    borderWidth: 0,
  },
  tabIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  menuContainer: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    minHeight: 72,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: 0.1,
  },
  menuItemSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xxs,
  },
  menuItemArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  securityText: {
    flex: 1,
  },
  securityTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xl,
    letterSpacing: 0.1,
  },
  securitySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.xs,
  },
  sectionBlock: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  inlineHeader: {
    gap: SPACING.xs,
  },
  inlineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  formStack: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  sessionText: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  sessionRevoke: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  signOutButton: {
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    minHeight: 64,
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  signOutText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: 0.1,
  },
  // Skeleton Loading Styles
  skeletonContainer: {
    gap: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  skeletonCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    gap: SPACING.md,
  },
  skeletonAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  skeletonLine: {
    height: 16,
    borderRadius: RADIUS.sm,
    alignSelf: 'center',
  },
  // Empty State Styles
  emptyState: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  emptyStateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  // Loading Indicator
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginTop: SPACING.md,
  },
  // Preferences Tab Styles
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  themeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.md,
  },
  themeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  themeLabelContainer: {
    flex: 1,
  },
  themePreviewRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  themePreviewCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    position: 'relative',
  },
  themePreviewCardActive: {
    borderWidth: 2,
  },
  themePreviewLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },
  themeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  preferenceItemContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  comingSoonBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  comingSoonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  // 2FA Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  modalIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  otpInput: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  modalSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  modalPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  resendButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  resendButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // OTP Countdown Timer Styles
  countdownContainer: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  countdownText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
