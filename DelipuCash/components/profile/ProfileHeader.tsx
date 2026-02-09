/**
 * ProfileHeader Component
 * Hero header with avatar, name, stats, and verification badge
 * 
 * Design: Instagram + TikTok + LinkedIn profile header (2025-2026 style)
 * Features:
 * - Large editable avatar with gradient border
 * - Personalized greeting with time-of-day context
 * - Verification badge with animation
 * - Quick stats row (points, earnings, streak)
 * - Edit profile action
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * - Semantic heading structure
 * - Screen reader optimized
 * - 44x44dp touch targets
 * 
 * @example
 * ```tsx
 * <ProfileHeader
 *   firstName="John"
 *   lastName="Doe"
 *   email="john@example.com"
 *   isVerified={true}
 *   totalEarnings={24880}
 *   streakDays={7}
 *   onEditPress={() => setEditing(true)}
 *   onAvatarPress={() => pickImage()}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BadgeCheck,
  Edit3,
  Camera,
  Flame,
  TrendingUp,
  Wallet,
  ChevronRight,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';
import { ProgressRing } from './ProgressRing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isTablet = SCREEN_WIDTH >= 768;

// Avatar sizes
const AVATAR_SIZE = isSmallScreen ? 80 : isTablet ? 120 : 100;
const AVATAR_BORDER = 4;

export interface ProfileHeaderProps {
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's email */
  email?: string;
  /** Whether user is verified */
  isVerified?: boolean;
  /** Avatar image URI (optional - shows initials if not provided) */
  avatarUri?: string;
  /** Total earnings amount */
  totalEarnings?: number;
  /** Wallet balance */
  walletBalance?: number;
  /** Current streak days */
  streakDays?: number;
  /** Maximum streak for progress calculation */
  maxStreak?: number;
  /** Total points/rewards */
  totalPoints?: number;
  /** Edit profile handler */
  onEditPress?: () => void;
  /** Avatar press handler (for image picker) */
  onAvatarPress?: () => void;
  /** Streak info press handler */
  onStreakPress?: () => void;
  /** Earnings press handler */
  onEarningsPress?: () => void;
  /** Whether in loading state */
  isLoading?: boolean;
  /** Test ID */
  testID?: string;
}

/**
 * Get time-of-day greeting
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Format currency in Ugandan Shillings (UGX)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function ProfileHeader({
  firstName,
  lastName,
  email,
  isVerified = false,
  avatarUri,
  totalEarnings = 0,
  walletBalance = 0,
  streakDays = 0,
  maxStreak = 30,
  totalPoints = 0,
  onEditPress,
  onAvatarPress,
  onStreakPress,
  onEarningsPress,
  isLoading = false,
  testID,
}: ProfileHeaderProps): React.ReactElement {
  const { colors } = useTheme();
  const greeting = useMemo(() => getGreeting(), []);
  
  // Animated values
  const editScale = useSharedValue(1);
  const badgePulse = useSharedValue(1);

  // Pulse animation for verified badge
  React.useEffect(() => {
    if (isVerified) {
      badgePulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerified]);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const editAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: editScale.value }],
  }));

  const handleEditPressIn = () => {
    editScale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handleEditPressOut = () => {
    editScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handleEditPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEditPress?.();
  };

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAvatarPress?.();
  };

  // Calculate streak progress (e.g., toward 30-day milestone)
  const streakProgress = Math.min(streakDays / maxStreak, 1);

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;

  return (
    <Animated.View
      entering={FadeIn.delay(50).duration(400)}
      style={[styles.container, { backgroundColor: colors.background }]}
      testID={testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Profile for ${fullName}`}
    >
      {/* Top Row: Avatar + Name + Edit */}
      <View style={styles.topRow}>
        {/* Avatar Section */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleAvatarPress}
          activeOpacity={0.8}
          accessibilityLabel={`Profile photo for ${fullName}. Tap to change`}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[colors.primary, withAlpha(colors.primary, 0.6)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarBorder}
          >
            <View style={[styles.avatarInner, { backgroundColor: colors.card }]}>
              {avatarUri ? (
                <Animated.Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  entering={FadeIn.duration(300)}
                />
              ) : (
                <LinearGradient
                  colors={[colors.primary, withAlpha(colors.primary, 0.7)]}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>

          {/* Camera overlay for edit hint */}
          {onAvatarPress && (
            <View style={[styles.cameraOverlay, { backgroundColor: withAlpha('#000', 0.6) }]}>
              <Camera size={16} color="#FFF" strokeWidth={2} />
            </View>
          )}

          {/* Verified Badge */}
          {isVerified && (
            <Animated.View
              style={[
                styles.verifiedBadge,
                { backgroundColor: colors.success, borderColor: colors.background },
                badgeAnimatedStyle,
              ]}
            >
              <BadgeCheck size={14} color="#FFF" strokeWidth={2.5} />
            </Animated.View>
          )}
        </TouchableOpacity>

        {/* Name & Info Section */}
        <View style={styles.infoContainer}>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <AccessibleText
              variant="caption"
              color="textMuted"
              style={styles.greeting}
              accessibilityLabel={`${greeting}, ${firstName}`}
            >
              {greeting} 👋
            </AccessibleText>
            
            <AccessibleText
              variant="h2"
              headingLevel={1}
              style={styles.name}
              numberOfLines={1}
            >
              {fullName}
            </AccessibleText>

            {isVerified && (
              <View style={styles.verifiedRow}>
                <BadgeCheck size={14} color={colors.success} strokeWidth={2} />
                <AccessibleText variant="bodySmall" color="success">
                  Verified Account
                </AccessibleText>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Edit Button */}
        {onEditPress && (
          <AnimatedTouchable
            style={[
              styles.editButton,
              { backgroundColor: withAlpha(colors.primary, 0.1) },
              editAnimatedStyle,
            ]}
            onPressIn={handleEditPressIn}
            onPressOut={handleEditPressOut}
            onPress={handleEditPress}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            accessibilityHint="Opens profile editor"
          >
            <Edit3 size={ICON_SIZE.lg} color={colors.primary} strokeWidth={2} />
          </AnimatedTouchable>
        )}
      </View>

      {/* Stats Row */}
      <Animated.View
        entering={FadeInUp.delay(200).springify()}
        style={styles.statsContainer}
      >
        {/* Wallet Balance */}
        <TouchableOpacity
          style={[styles.statItem, { backgroundColor: withAlpha(colors.primary, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEarningsPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Wallet balance: ${formatCurrency(walletBalance)}`}
          accessibilityRole="button"
          accessibilityHint="View wallet details"
        >
          <View style={[styles.statIcon, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
            <Wallet size={ICON_SIZE.base} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.statContent}>
            <AccessibleText variant="caption" color="textMuted">Balance</AccessibleText>
            <AccessibleText variant="h4" bold accessibilityLiveRegion="polite">
              {formatCurrency(walletBalance)}
            </AccessibleText>
          </View>
          <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Total Earnings */}
        <TouchableOpacity
          style={[styles.statItem, { backgroundColor: withAlpha(colors.success, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEarningsPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Total earnings: ${formatCurrency(totalEarnings)}`}
          accessibilityRole="button"
        >
          <View style={[styles.statIcon, { backgroundColor: withAlpha(colors.success, 0.15) }]}>
            <TrendingUp size={ICON_SIZE.base} color={colors.success} strokeWidth={2} />
          </View>
          <View style={styles.statContent}>
            <AccessibleText variant="caption" color="textMuted">Earned</AccessibleText>
            <AccessibleText variant="h4" bold color="success">
              {formatCurrency(totalEarnings)}
            </AccessibleText>
          </View>
        </TouchableOpacity>

        {/* Streak with Progress Ring */}
        <TouchableOpacity
          style={[styles.statItem, styles.streakItem, { backgroundColor: withAlpha(colors.warning, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onStreakPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Current streak: ${streakDays} days. Progress toward ${maxStreak}-day goal.`}
          accessibilityRole="button"
          accessibilityHint="View streak details and rewards"
        >
          <ProgressRing
            progress={streakProgress}
            size={48}
            strokeWidth={4}
            color={colors.warning}
            gradientEndColor={colors.error}
          >
            <Flame size={18} color={colors.warning} strokeWidth={2} />
          </ProgressRing>
          <View style={styles.statContent}>
            <AccessibleText variant="caption" color="textMuted">Streak</AccessibleText>
            <AccessibleText variant="h4" bold color="warning">
              {streakDays} days
            </AccessibleText>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: SPACING.lg,
  },
  avatarBorder: {
    width: AVATAR_SIZE + AVATAR_BORDER * 2,
    height: AVATAR_SIZE + AVATAR_BORDER * 2,
    borderRadius: (AVATAR_SIZE + AVATAR_BORDER * 2) / 2,
    padding: AVATAR_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: AVATAR_SIZE * 0.36,
    color: '#FFF',
    letterSpacing: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: AVATAR_BORDER,
    right: AVATAR_BORDER,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  infoContainer: {
    flex: 1,
  },
  greeting: {
    marginBottom: SPACING.xxs,
  },
  name: {
    marginBottom: SPACING.xs,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  editButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    minHeight: 64,
  },
  streakItem: {
    paddingLeft: SPACING.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
});

export default ProfileHeader;
