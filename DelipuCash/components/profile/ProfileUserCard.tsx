/**
 * ProfileUserCard Component
 * 
 * Beautiful user profile card with avatar, edit profile, and earnings/streak context.
 * Combines the best of Instagram, Cash App, and Duolingo profile design patterns.
 * 
 * Design Features:
 * - Large avatar with gradient border and verification badge
 * - Edit profile button with smooth animations
 * - Earnings & streak stats in prominent display
 * - Premium gradient accents
 * - Smooth spring animations
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * 
 * @module components/profile/ProfileUserCard
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BadgeCheck,
  Edit3,
  Camera,
  Shield,
  Zap,
  ChevronRight,
  Mail,
  Phone,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isTablet = SCREEN_WIDTH >= 768;

// Avatar sizes
const AVATAR_SIZE = isSmallScreen ? 72 : isTablet ? 100 : 84;



export interface ProfileUserCardProps {
  /** User's first name */
  firstName: string;
  /** User's last name */
  lastName: string;
  /** User's email */
  email?: string;
  /** User's phone number */
  phone?: string;
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
  /** Edit profile handler */
  onEditPress?: () => void;
  /** Avatar press handler (for image picker) */
  onAvatarPress?: () => void;
  /** Streak info press handler */
  onStreakPress?: () => void;
  /** Earnings press handler */
  onEarningsPress?: () => void;
  /** Wallet press handler */
  onWalletPress?: () => void;
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
 * Formatter is created once (module-level) to avoid >16ms frame drops
 * from re-creating Intl.NumberFormat on every render.
 */
const ugxFormatter = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  currencyDisplay: 'code',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
function formatCurrency(amount: number): string {
  return ugxFormatter.format(amount);
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function ProfileUserCard({
  firstName,
  lastName,
  email,
  phone,
  isVerified = false,
  avatarUri,
  totalEarnings = 0,
  walletBalance = 0,
  streakDays = 0,
  maxStreak = 30,
  onEditPress,
  onAvatarPress,
  onStreakPress,
  onEarningsPress,
  onWalletPress,
  isLoading = false,
  testID,
}: ProfileUserCardProps): React.ReactElement {
  const { colors } = useTheme();
  const greeting = useMemo(() => getGreeting(), []);

  // Animated values
  const editScale = useSharedValue(1);
  const badgePulse = useSharedValue(1);

  // Pulse animation for verified badge — respects reduced motion
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    if (isVerified && !reduceMotion) {
      badgePulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      badgePulse.value = 1;
    }
  }, [isVerified, badgePulse, reduceMotion]);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const editAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: editScale.value }],
  }));

  const handleEditPressIn = () => {
    editScale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
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

  // ── Normalised name parts (trim whitespace, treat blank as absent) ──
  const normFirst = useMemo(() => firstName?.trim() || '', [firstName]);
  const normLast  = useMemo(() => lastName?.trim()  || '', [lastName]);
  const normEmail = useMemo(() => email?.trim()      || '', [email]);

  // Extract a readable username from email (before the @)
  const emailUsername = useMemo(() => {
    if (!normEmail) return '';
    const atIdx = normEmail.indexOf('@');
    return atIdx > 0 ? normEmail.slice(0, atIdx) : normEmail;
  }, [normEmail]);

  // Deterministic initials: name chars → email-username initial → 'U'
  const initials = useMemo(() => {
    const fi = normFirst.charAt(0);
    const li = normLast.charAt(0);
    if (fi || li) return `${fi}${li}`.toUpperCase();
    if (emailUsername) return emailUsername.charAt(0).toUpperCase();
    return 'U';
  }, [normFirst, normLast, emailUsername]);

  // Display name: "First Last" → "First" → "Last" → email username → "User"
  const hasName = Boolean(normFirst || normLast);
  const fullName = useMemo(() => {
    if (normFirst && normLast) return `${normFirst} ${normLast}`;
    if (normFirst) return normFirst;
    if (normLast) return normLast;
    if (emailUsername) return emailUsername;
    return 'User';
  }, [normFirst, normLast, emailUsername]);

  // Mask phone for display: +256 7** *** **0
  const maskedPhone = useMemo(() => {
    if (!phone) return '';
    if (phone.length <= 4) return phone;
    return phone.slice(0, 4) + ' *** ' + phone.slice(-2);
  }, [phone]);

  return (
    <Animated.View
      entering={FadeIn.delay(50).duration(400).reduceMotion(ReduceMotion.System)}
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: withAlpha(colors.border, 0.6) },
      ]}
      testID={testID}
      accessible
      accessibilityLabel={`Profile card for ${fullName}`}
    >
      {/* Card Header with Edit Button */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconBg, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
            <BadgeCheck size={ICON_SIZE.base} color={colors.primary} strokeWidth={2} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Information</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>Your account details</Text>
          </View>
        </View>
        
        {/* Edit Button */}
        {onEditPress && (
          <AnimatedTouchable
            style={[
              styles.editButton,
              { backgroundColor: withAlpha(colors.primary, 0.1), borderColor: colors.border },
              editAnimatedStyle,
            ]}
            onPressIn={handleEditPressIn}
            onPressOut={handleEditPressOut}
            onPress={handleEditPress}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
            accessibilityHint="Opens profile editor"
          >
            <Edit3 size={ICON_SIZE.base} color={colors.primary} strokeWidth={2} />
          </AnimatedTouchable>
        )}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: withAlpha(colors.border, 0.6) }]} />

      {/* User Info Section */}
      <View style={styles.userSection}>
        {/* Avatar */}
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
                <ExpoImage
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  transition={300}
                  recyclingKey={avatarUri}
                  accessibilityLabel={`Profile photo for ${fullName}`}
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
              <Camera size={14} color="#FFF" strokeWidth={2} />
            </View>
          )}

          {/* Verified Badge */}
          {isVerified && (
            <Animated.View
              style={[
                styles.verifiedBadge,
                { backgroundColor: colors.success, borderColor: colors.card },
                badgeAnimatedStyle,
              ]}
            >
              <BadgeCheck size={12} color="#FFF" strokeWidth={2.5} />
            </Animated.View>
          )}
        </TouchableOpacity>

        {/* Name & Details */}
        <View style={styles.userInfo}>
          <Animated.View entering={FadeInDown.delay(100).springify().reduceMotion(ReduceMotion.System)}>
            <Text style={[styles.greeting, { color: colors.textMuted }]}>{greeting} 👋</Text>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {fullName}
            </Text>

            {/* Nudge if name is missing — email is used as display name */}
            {!hasName && normEmail ? (
              <Text style={[styles.contactHint, { color: colors.warning }]}>
                Tap edit to add your name
              </Text>
            ) : null}

            {/* Email — always visible; shows placeholder when absent */}
            <View style={styles.contactRow}>
              <Mail size={12} color={normEmail ? colors.textMuted : colors.warning} strokeWidth={1.5} />
              <Text
                style={[
                  styles.contactText,
                  { color: normEmail ? colors.textMuted : colors.warning },
                ]}
                numberOfLines={1}
              >
                {normEmail || 'No email set'}
              </Text>
            </View>

            {/* Phone — masked for on-screen privacy */}
            {maskedPhone ? (
              <View style={styles.contactRow}>
                <Phone size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={[styles.contactText, { color: colors.textMuted }]} numberOfLines={1}>
                  {maskedPhone}
                </Text>
              </View>
            ) : null}

            {isVerified && (
              <View style={[styles.verifiedRow, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                <Shield size={12} color={colors.success} strokeWidth={2} />
                <Text style={[styles.verifiedText, { color: colors.success }]}>Verified Account</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>

      {/* Stats Row - Earnings & Streak */}
      <Animated.View
        entering={FadeInUp.delay(200).springify().reduceMotion(ReduceMotion.System)}
        style={styles.statsContainer}
      >
        {/* Wallet Balance */}
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: withAlpha(colors.primary, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onWalletPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Wallet balance: ${formatCurrency(walletBalance)}`}
          accessibilityRole="button"
        >
          <View style={styles.statContent}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Balance</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{formatCurrency(walletBalance)}</Text>
          </View>
        </TouchableOpacity>

        {/* Total Earnings */}
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: withAlpha(colors.success, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEarningsPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Total earnings: ${formatCurrency(totalEarnings)}`}
          accessibilityRole="button"
        >
          <View style={styles.statContent}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Earned</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(totalEarnings)}</Text>
          </View>
        </TouchableOpacity>

        {/* Streak */}
        <TouchableOpacity
          style={[styles.statCard, { backgroundColor: withAlpha(colors.warning, 0.08) }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onStreakPress?.();
          }}
          activeOpacity={0.7}
          accessibilityLabel={`Current streak: ${streakDays} days`}
          accessibilityRole="button"
        >
          <View style={styles.statContent}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
            <Text style={[styles.statValue, { color: colors.warning }]}>{streakDays} days</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom CTA - View Activity */}
      <TouchableOpacity
        style={[styles.activityCta, { backgroundColor: withAlpha(colors.info, 0.08), borderTopColor: withAlpha(colors.border, 0.6) }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onEarningsPress?.();
        }}
        activeOpacity={0.7}
        accessibilityLabel="View all activity and earnings"
        accessibilityRole="button"
      >
        <View style={styles.ctaContent}>
          <Zap size={ICON_SIZE.base} color={colors.info} strokeWidth={2} />
          <Text style={[styles.ctaText, { color: colors.info }]}>View Activity & Earnings</Text>
        </View>
        <ChevronRight size={ICON_SIZE.base} color={colors.info} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: SPACING.lg,
  },

  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBorder: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: (AVATAR_SIZE + 6) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
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
  },
  avatarInitials: {
    fontSize: AVATAR_SIZE * 0.35,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Info
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  userName: {
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize.xl : TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  verifiedText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  contactText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  contactHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 2,
  },

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xl,
    minHeight: 48,
  },
  statContent: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  statValue: {
    fontSize: isSmallScreen ? TYPOGRAPHY.fontSize.base : TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    letterSpacing: -0.3,
  },

  // Activity CTA
  activityCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    minHeight: 48,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ctaText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    letterSpacing: -0.2,
  },
});

export default ProfileUserCard;
