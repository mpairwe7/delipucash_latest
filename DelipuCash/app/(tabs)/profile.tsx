import { FormInput, NotificationBell, PrimaryButton, SectionHeader } from "@/components";
import { useUnreadCount, useUserStats } from "@/services/hooks";
import { useAuth } from "@/utils/auth/useAuth";
import {
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  ThemeColors,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from "@/utils/theme";
import useUser from "@/utils/useUser";
import { Href, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import {
  ArrowRightLeft,
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Edit,
  Eye,
  History,
  KeyRound,
  LogOut,
  LucideIcon,
  MessageSquare,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react-native";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MenuItem {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  onPress: () => void;
}

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

interface MenuItemComponentProps {
  item: MenuItem;
  isLast: boolean;
  colors: ThemeColors;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MenuItemComponent = memo<MenuItemComponentProps>(
  ({ item, isLast, colors }) => {
    const Icon = item.icon;
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(0.8, { duration: 100 });
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      opacity.value = withTiming(1, { duration: 100 });
    };

    const handlePress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      item.onPress();
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
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityHint={item.subtitle || `Navigate to ${item.label}`}
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
  },
);

MenuItemComponent.displayName = "MenuItemComponent";

// Enhanced Stat Card Component
interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  colors: ThemeColors;
  delay?: number;
}

const StatCard = memo<StatCardProps>(({ label, value, icon: Icon, color, colors, delay = 0 }) => (
  <Animated.View
    entering={FadeInUp.delay(delay).springify()}
    style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}
    accessibilityLabel={`${label}: ${value}`}
    accessibilityRole="text"
  >
    <View style={[styles.statIconContainer, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Icon size={ICON_SIZE.md} color={color} strokeWidth={1.5} />
    </View>
    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    <Text style={[styles.statValue, { color: colors.text }]}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
  </Animated.View>
));

StatCard.displayName = "StatCard";

// Enhanced Engagement Card Component
interface EngagementCardProps {
  label: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  colors: ThemeColors;
  index: number;
}

const EngagementCard = memo<EngagementCardProps>(({ label, value, subtitle, icon: Icon, color, colors, index }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <Animated.View
        entering={FadeInDown.delay(100 + index * 100).springify()}
        style={[
          styles.engagementCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          animatedStyle,
        ]}
        accessibilityLabel={`${label}: ${value} ${subtitle}`}
        accessibilityRole="text"
      >
        <View style={styles.engagementHeader}>
          <View style={[styles.engagementIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
            <Icon size={ICON_SIZE.md} color={color} strokeWidth={1.5} />
          </View>
        </View>
        <Text style={[styles.engagementValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.engagementLabel, { color: colors.textMuted }]}>{label}</Text>
        <View style={[styles.engagementBadge, { backgroundColor: withAlpha(color, 0.1) }]}>
          <Text style={[styles.engagementSub, { color }]}>{subtitle}</Text>
        </View>
      </Animated.View>
    </AnimatedPressable>
  );
});

EngagementCard.displayName = "EngagementCard";

export default function ProfileScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colors, statusBarStyle } = useTheme();
  const { signOut } = useAuth();
  const { data: user } = useUser();
  const { data: unreadCount } = useUnreadCount();
  const { data: userStats } = useUserStats();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(Boolean(user?.twoFactorEnabled));
  const [changePassword, setChangePassword] = useState({ current: "", next: "", confirm: "" });
  const [privacy, setPrivacy] = useState({ shareProfile: true, shareActivity: false });
  const [sessions, setSessions] = useState([
    { id: "1", device: "Pixel 7", location: "Kampala", lastActive: "2m ago" },
    { id: "2", device: "iPad", location: "Nairobi", lastActive: "1h ago" },
  ]);
  const [airtelLinked, setAirtelLinked] = useState(false);
  const [mtnLinked, setMtnLinked] = useState(false);
  const [activeTab, setActiveTab] = useState<'engagement' | 'shortcuts' | 'security' | 'payments'>('engagement');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: user?.firstName || "John",
    lastName: user?.lastName || "Doe",
    email: user?.email || "user@example.com",
    telephone: user?.telephone || "+256 XXX XXX XXX",
  });

  const tabs = [
    { key: 'engagement', label: 'Activity', icon: Sparkles },
    { key: 'shortcuts', label: 'Shortcuts', icon: ArrowRightLeft },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'payments', label: 'Payments', icon: CreditCard },
  ] as const;

  const profile: ProfileData = {
    firstName: user?.firstName || "John",
    lastName: user?.lastName || "Doe",
    email: user?.email || "user@example.com",
    telephone: user?.telephone || "+256 XXX XXX XXX",
    walletBalance: user?.walletBalance || 12404.44,
    totalEarnings: user?.totalEarnings || 24880.0,
    totalRewards: user?.totalRewards || 1240.0,
    twoFactorEnabled,
    activeSessions: sessions.length,
  };

  const handleSignOut = (): void => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const handleChangePassword = (): void => {
    if (!changePassword.current || !changePassword.next || !changePassword.confirm) {
      Alert.alert("Missing fields", "Please fill all password fields.");
      return;
    }
    if (changePassword.next.length < 8) {
      Alert.alert("Weak password", "Use at least 8 characters.");
      return;
    }
    if (changePassword.next !== changePassword.confirm) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    Alert.alert("Password updated", "Your password has been changed.");
    setChangePassword({ current: "", next: "", confirm: "" });
  };

  const handleWithdraw = useCallback((): void => {
    if (profile.walletBalance <= 0) {
      Alert.alert("Insufficient funds", "You need a positive balance to withdraw.");
      return;
    }
    Alert.alert(
      "Withdraw",
      "Proceed to withdrawal and confirm mobile money details?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", style: "default", onPress: () => router.push("/(tabs)/withdraw") },
      ],
    );
  }, [profile.walletBalance]);

  const toggleTwoFactor = (): void => {
    const nextValue = !twoFactorEnabled;
    setTwoFactorEnabled(nextValue);
    Alert.alert(
      "Two-factor authentication",
      nextValue
        ? "2FA (OTP) enabled. Codes will be required at sign-in."
        : "2FA disabled. Re-enable to secure your account.",
    );
  };

  const handleRevokeSession = (id: string): void => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    Alert.alert("Session signed out", "Selected session has been revoked.");
  };

  const handleTogglePrivacy = (key: keyof typeof privacy): void => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEditProfile = (): void => {
    setIsEditing(true);
  };

  const handleCancelEdit = (): void => {
    setEditForm({
      firstName: user?.firstName || "John",
      lastName: user?.lastName || "Doe",
      email: user?.email || "user@example.com",
      telephone: user?.telephone || "+256 XXX XXX XXX",
    });
    setIsEditing(false);
  };

  const handleSaveProfile = async (): Promise<void> => {
    try {
      // TODO: Implement API call to update profile
      // For now, just show success message
      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => setIsEditing(false)
        }
      ]);
    } catch {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  const handleLinkAirtel = (): void => {
    setAirtelLinked(true);
    Alert.alert("Airtel Money", "Account linked successfully.");
  };

  const handleLinkMTN = (): void => {
    setMtnLinked(true);
    Alert.alert("MTN Mobile Money", "Account linked successfully.");
  };

  const quickActions = useMemo<MenuItem[]>(
    () => [
      {
        icon: Edit,
        label: "Edit profile",
        subtitle: "Update personal details",
        onPress: handleEditProfile,
      },
      {
        icon: Wallet,
        label: "Wallet",
        subtitle: "Balance & withdraw",
        onPress: handleWithdraw,
      },
      {
        icon: History,
        label: "Transactions",
        subtitle: "View history",
        onPress: () => router.push("/(tabs)/transactions"),
      },
      {
        icon: ShieldCheck,
        label: "Security",
        subtitle: "2FA, privacy",
        onPress: () => Alert.alert("Security", "Manage security settings from here."),
      },
    ],
    [handleWithdraw],
  );

  const paymentItems: MenuItem[] = [
    {
      icon: CreditCard,
      label: "Airtel Money",
      subtitle: airtelLinked ? "Linked for deposits" : "Link to receive",
      onPress: airtelLinked
        ? () => Alert.alert("Airtel Money", "Account already linked.")
        : handleLinkAirtel,
    },
    {
      icon: CreditCard,
      label: "MTN Mobile Money",
      subtitle: mtnLinked ? "Linked for payouts" : "Link to send",
      onPress: mtnLinked
        ? () => Alert.alert("MTN Mobile Money", "Account already linked.")
        : handleLinkMTN,
    },
    {
      icon: Wallet,
      label: "Wallet balance",
      subtitle: `$${profile.walletBalance.toFixed(2)}`,
      onPress: () => router.push("/(tabs)/withdraw"),
    },
    {
      icon: History,
      label: "Transaction history",
      subtitle: "Receipts and payouts",
      onPress: () => router.push("/(tabs)/transactions"),
    },
    {
      icon: ArrowUpRight,
      label: "Withdraw",
      subtitle: "Confirm before sending",
      onPress: handleWithdraw,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={statusBarStyle} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACING.lg,
            paddingBottom: insets.bottom + SPACING["2xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
            <NotificationBell
              count={unreadCount ?? 0}
              onPress={() => router.push("/notifications" as Href)}
            />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Personal info, security, and payouts</Text>
        </View>

        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View
                style={[styles.avatar, { backgroundColor: colors.primary }]}
                accessibilityLabel="User profile picture"
                accessibilityRole="image"
                accessibilityHint="Shows your initials"
              >
                <Text style={styles.avatarText}>
                  {isEditing ? editForm.firstName.charAt(0) : profile.firstName.charAt(0)}
                  {isEditing ? editForm.lastName.charAt(0) : profile.lastName.charAt(0)}
                </Text>
              </View>
              <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                <BadgeCheck size={ICON_SIZE.sm} color="#FFFFFF" strokeWidth={2} />
              </View>
            </View>
            {!isEditing ? (
              <PrimaryButton
                title="Edit Profile"
                onPress={handleEditProfile}
                size="small"
                variant="secondary"
                leftIcon={<Edit size={ICON_SIZE.md} color={colors.text} />}
                style={styles.editButton}
                accessibilityLabel="Edit profile"
              />
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={[styles.editActionButton, { backgroundColor: colors.secondary }]}
                  accessibilityLabel="Cancel edit"
                >
                  <Text style={[styles.editActionText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <PrimaryButton
                  title="Save"
                  onPress={handleSaveProfile}
                  size="small"
                  style={styles.saveButton}
                  accessibilityLabel="Save profile changes"
                />
                </View>
            )}
          </View>

          <View style={styles.profileDetails}>
            {isEditing ? (
              <View style={styles.editForm}>
                <View style={styles.nameInputs}>
                  <FormInput
                    label="First Name"
                    value={editForm.firstName}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, firstName: text }))}
                    placeholder="Enter first name"
                    style={styles.nameInput}
                  />
                  <FormInput
                    label="Last Name"
                    value={editForm.lastName}
                    onChangeText={(text) => setEditForm(prev => ({ ...prev, lastName: text }))}
                    placeholder="Enter last name"
                    style={styles.nameInput}
                  />
                </View>
                <FormInput
                  label="Email"
                  value={editForm.email}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                  placeholder="Enter email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormInput
                  label="Phone Number"
                  value={editForm.telephone}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, telephone: text }))}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>
            ) : (
              <>
                <Text style={[styles.profileName, { color: colors.text }]}>{profile.firstName} {profile.lastName}</Text>
                <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{profile.email}</Text>
                <Text style={[styles.profilePhone, { color: colors.textMuted }]}>{profile.telephone}</Text>
              </>
            )}
          </View>

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
              icon={Star}
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
        </Animated.View>

        <Animated.View entering={FadeIn.delay(400)} style={styles.tabsContainer}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tabButton,
                  isActive && [
                    styles.tabButtonActive,
                    { backgroundColor: withAlpha(colors.primary, 0.12) }
                  ],
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityHint={`Switch to ${tab.label} section`}
              >
                <View style={[
                  styles.tabIconContainer,
                  isActive && { backgroundColor: colors.primary }
                ]}>
                  <Icon
                    size={ICON_SIZE.sm}
                    color={isActive ? "#FFFFFF" : colors.textMuted}
                    strokeWidth={2}
                  />
                </View>
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : colors.textMuted },
                  isActive && styles.tabLabelActive
                ]}>
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

        {activeTab === 'engagement' && (
          <Animated.View entering={FadeInDown.springify()}>
            <SectionHeader
              title="Activity"
              subtitle="Your engagement snapshot"
              icon={<Sparkles size={ICON_SIZE.base} color={colors.primary} />}
            />
            <View style={styles.engagementGrid}>
              <EngagementCard
                label="Likes"
                value={userStats?.rewardsThisWeek ?? 0}
                subtitle="This week"
                icon={ThumbsUp}
                color={colors.success}
                colors={colors}
                index={0}
              />
              <EngagementCard
                label="Answered"
                value={userStats?.totalAnswers ?? 0}
                subtitle="Lifetime"
                icon={MessageSquare}
                color={colors.info}
                colors={colors}
                index={1}
              />
              <EngagementCard
                label="Rewards"
                value={userStats?.totalRewards ?? 0}
                subtitle="Earned"
                icon={Sparkles}
                color={colors.warning}
                colors={colors}
                index={2}
              />
            </View>

            <Animated.View entering={FadeInUp.delay(400).springify()}>
              <PrimaryButton
                title="View Dashboard"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push("/(tabs)/home");
                }}
                leftIcon={<TrendingUp size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={1.5} />}
                style={styles.dashboardCta}
                accessibilityLabel="Open your dashboard"
                accessibilityHint="Navigate to the home dashboard"
              />
            </Animated.View>
          </Animated.View>
        )}

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
              accessibilityLabel="Quick access shortcuts"
              accessibilityRole="list"
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
              accessibilityLabel="Security controls"
              accessibilityRole="region"
            >
              <View style={[styles.securityRow, { borderColor: colors.border }]} accessibilityLabel="Two-factor authentication">
                <View style={styles.securityText}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>Two-factor authentication</Text>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>OTP required at sign-in to protect access.</Text>
                </View>
                <Switch
                  value={twoFactorEnabled}
                  onValueChange={toggleTwoFactor}
                  thumbColor={twoFactorEnabled ? colors.primary : colors.border}
                  trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
                />
              </View>

          <View style={[styles.sectionBlock, { borderColor: colors.border }]}
            accessibilityLabel="Change password form"
          >
            <View style={[styles.inlineHeader, { marginBottom: SPACING.sm }]}
            >
              <View style={styles.inlineTitleRow}>
                <KeyRound size={ICON_SIZE.base} color={colors.text} />
                <Text style={[styles.securityTitle, { color: colors.text }]}>Change password</Text>
              </View>
              <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>Use a strong unique password.</Text>
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

          <View style={[styles.sectionBlock, { borderColor: colors.border }]}
            accessibilityLabel="Privacy controls"
          >
            <View style={styles.inlineHeader}>
              <View style={styles.inlineTitleRow}>
                <Eye size={ICON_SIZE.base} color={colors.text} />
                <Text style={[styles.securityTitle, { color: colors.text }]}>Privacy controls</Text>
              </View>
              <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>Control data visibility and sharing.</Text>
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.securityTitle, { color: colors.text }]}>Public profile</Text>
              <Switch
                value={privacy.shareProfile}
                onValueChange={() => handleTogglePrivacy("shareProfile")}
                thumbColor={privacy.shareProfile ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
              />
            </View>
            <View style={styles.toggleRow}>
              <Text style={[styles.securityTitle, { color: colors.text }]}>Show activity</Text>
              <Switch
                value={privacy.shareActivity}
                onValueChange={() => handleTogglePrivacy("shareActivity")}
                thumbColor={privacy.shareActivity ? colors.primary : colors.border}
                trackColor={{ false: colors.border, true: withAlpha(colors.primary, 0.4) }}
              />
            </View>
          </View>

          <View style={[styles.sectionBlock, { borderColor: colors.border }]}
            accessibilityLabel="Active sessions"
          >
            <View style={styles.inlineHeader}>
              <View style={styles.inlineTitleRow}>
                <Smartphone size={ICON_SIZE.base} color={colors.text} />
                <Text style={[styles.securityTitle, { color: colors.text }]}>Active sessions</Text>
              </View>
              <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>Sign out devices you no longer use.</Text>
            </View>
            {sessions.map((session) => (
              <View key={session.id} style={[styles.sessionItem, { borderColor: colors.border }]}>
                <View style={styles.sessionText}>
                  <Text style={[styles.securityTitle, { color: colors.text }]}>{session.device}</Text>
                  <Text style={[styles.securitySubtitle, { color: colors.textMuted }]}>{session.location} · {session.lastActive}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRevokeSession(session.id)}>
                  <Text style={[styles.sessionRevoke, { color: colors.error }]}>Sign out</Text>
                </TouchableOpacity>
              </View>
            ))}
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
              accessibilityLabel="Payments and wallet options"
              accessibilityRole="list"
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

        <Animated.View entering={FadeIn.delay(500)}>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              handleSignOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out of your account"
            accessibilityHint="Double tap to sign out"
          >
            <View style={[styles.signOutIcon, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
              <LogOut size={ICON_SIZE.base} color={colors.error} strokeWidth={2} />
            </View>
            <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
            <ChevronRight size={ICON_SIZE.base} color={colors.error} strokeWidth={1.5} />
          </Pressable>
        </Animated.View>
      </ScrollView>
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
    marginBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["4xl"], // Larger for better visibility
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg, // Slightly larger for clarity
    color: '#7A7A7A',
  },
  profileCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: SPACING.md,
  },
  avatar: {
    width: COMPONENT_SIZE.avatar.xl + 8,
    height: COMPONENT_SIZE.avatar.xl + 8,
    borderRadius: (COMPONENT_SIZE.avatar.xl + 8) / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["4xl"], // Larger initials for avatar
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    marginBottom: SPACING.xs,
    letterSpacing: 0.1,
  },
  profileEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.lg, // Larger for readability
    color: '#7A7A7A',
  },
  profilePhone: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base, // Larger for accessibility
    marginTop: SPACING.xs,
    color: '#7A7A7A',
  },
  editButton: {
    minWidth: COMPONENT_SIZE.button.small,
    height: COMPONENT_SIZE.button.small,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  statItem: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: "center",
    gap: SPACING.xs,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    color: '#7A7A7A',
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    letterSpacing: 0.1,
    textAlign: "center",
  },
  engagementGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  engagementCard: {
    flex: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: "center",
    gap: SPACING.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  engagementHeader: {
    alignItems: "center",
    justifyContent: "center",
  },
  engagementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  engagementLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    color: '#7A7A7A',
  },
  engagementValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    letterSpacing: 0.1,
    textAlign: "center",
  },
  engagementBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  engagementSub: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: "center",
  },
  dashboardCta: {
    marginBottom: SPACING.xl,
  },
  menuContainer: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
    minHeight: 72,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  menuItemArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg, // Larger for touch targets
    letterSpacing: 0.1,
  },
  menuItemSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base, // Larger for clarity
    marginTop: SPACING.xxs,
    color: '#7A7A7A',
  },
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  securityText: {
    flex: 1,
  },
  securityTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xl, // Larger for accessibility
    letterSpacing: 0.1,
  },
  securitySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base, // Larger for clarity
    marginTop: SPACING.xs,
    color: '#7A7A7A',
  },
  signOutButton: {
    borderRadius: RADIUS.xl,
    padding: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    minHeight: 64,
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  signOutText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: 0.1,
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
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  formStack: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  profileHeader: {
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  statsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.lg,
    gap: SPACING.xs,
    position: "relative",
    overflow: "hidden",
  },
  tabButtonActive: {
    borderWidth: 0,
  },
  tabIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: "center",
  },
  tabLabelActive: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 4,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  editActions: {
    flexDirection: "row",
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
  saveButton: {
    minWidth: COMPONENT_SIZE.button.small,
  },
  editForm: {
    gap: SPACING.md,
  },
  nameInputs: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  nameInput: {
    flex: 1,
  },
});
