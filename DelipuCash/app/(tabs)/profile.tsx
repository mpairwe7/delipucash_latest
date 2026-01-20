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
import { StatusBar } from "expo-status-bar";
import {
  ArrowRightLeft,
  ArrowUpRight,
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
  ThumbsUp,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

const MenuItemComponent = memo<MenuItemComponentProps>(
  ({ item, isLast, colors }) => {
    const Icon = item.icon;
    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        ]}
        onPress={item.onPress}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        <View style={[styles.menuItemIcon, { backgroundColor: colors.secondary }]}>
          <Icon size={ICON_SIZE.base} color={colors.text} strokeWidth={1.5} />
        </View>
        <View style={styles.menuItemContent}>
          <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
          {item.subtitle && (
            <Text style={[styles.menuItemSubtitle, { color: colors.textMuted }]}>{item.subtitle}</Text>
          )}
        </View>
        <ChevronRight size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={1.5} />
      </TouchableOpacity>
    );
  },
);

MenuItemComponent.displayName = "MenuItemComponent";

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
        onPress: () => router.push("/(tabs)/profile"),
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

        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={styles.profileInfo}>
            <View
              style={[styles.avatar, { backgroundColor: colors.primary }]}
              accessibilityLabel="User initials"
              accessibilityRole="image"
            >
              <Text style={styles.avatarText}>
                {profile.firstName.charAt(0)}
                {profile.lastName.charAt(0)}
              </Text>
            </View>

            <View style={styles.profileDetails}>
              <Text style={[styles.profileName, { color: colors.text }]}>{profile.firstName} {profile.lastName}</Text>
              <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{profile.email}</Text>
              <Text style={[styles.profilePhone, { color: colors.text }]}>{profile.telephone}</Text>
            </View>

            <PrimaryButton
              title="Edit"
              onPress={() => router.push("/(tabs)/profile")}
              size="small"
              variant="secondary"
              leftIcon={<Edit size={ICON_SIZE.md} color={colors.text} />}
              style={styles.editButton}
              accessibilityLabel="Edit profile"
            />
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: colors.secondary }]} accessibilityLabel="Wallet balance">
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wallet balance</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>${profile.walletBalance.toLocaleString()}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.secondary }]} accessibilityLabel="Total earnings">
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Earnings</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>${profile.totalEarnings.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: colors.secondary }]} accessibilityLabel="Rewards">
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rewards</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>${profile.totalRewards.toLocaleString()}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.secondary }]} accessibilityLabel="Active sessions">
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active sessions</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{profile.activeSessions}</Text>
            </View>
          </View>
        </View>

        <SectionHeader
          title="Engagement"
          subtitle="Your activity snapshot"
          icon={<Sparkles size={ICON_SIZE.base} color={colors.primary} />}
        />
        <View style={styles.engagementGrid}>
          <View style={[styles.engagementCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityLabel="Likes received"
          >
            <View style={styles.engagementHeader}>
              <View style={[styles.engagementIcon, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
                <ThumbsUp size={ICON_SIZE.md} color={colors.success} strokeWidth={1.5} />
              </View>
              <Text style={[styles.engagementLabel, { color: colors.textMuted }]}>Likes</Text>
            </View>
            <Text style={[styles.engagementValue, { color: colors.text }]}>
              {userStats?.rewardsThisWeek ?? 0}
            </Text>
            <Text style={[styles.engagementSub, { color: colors.textMuted }]}>This week</Text>
          </View>

          <View style={[styles.engagementCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityLabel="Answers submitted"
          >
            <View style={styles.engagementHeader}>
              <View style={[styles.engagementIcon, { backgroundColor: withAlpha(colors.info, 0.12) }]}>
                <MessageSquare size={ICON_SIZE.md} color={colors.info} strokeWidth={1.5} />
              </View>
              <Text style={[styles.engagementLabel, { color: colors.textMuted }]}>Answered</Text>
            </View>
            <Text style={[styles.engagementValue, { color: colors.text }]}>
              {userStats?.totalAnswers ?? 0}
            </Text>
            <Text style={[styles.engagementSub, { color: colors.textMuted }]}>Lifetime</Text>
          </View>

          <View style={[styles.engagementCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityLabel="Rewards earned"
          >
            <View style={styles.engagementHeader}>
              <View style={[styles.engagementIcon, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
                <Sparkles size={ICON_SIZE.md} color={colors.warning} strokeWidth={1.5} />
              </View>
              <Text style={[styles.engagementLabel, { color: colors.textMuted }]}>Rewards</Text>
            </View>
            <Text style={[styles.engagementValue, { color: colors.text }]}>
              {userStats?.totalRewards ?? 0}
            </Text>
            <Text style={[styles.engagementSub, { color: colors.textMuted }]}>Earned</Text>
          </View>
        </View>

        <PrimaryButton
          title="My dashboard"
          onPress={() => router.push("/(tabs)/home")}
          leftIcon={<TrendingUp size={ICON_SIZE.md} color={colors.primaryText} strokeWidth={1.5} />}
          style={styles.dashboardCta}
          accessibilityLabel="Open dashboard"
        />

        <SectionHeader
          title="Shortcuts"
          subtitle="Go to frequent actions"
          icon={<ArrowRightLeft size={ICON_SIZE.base} color={colors.primary} />}
        />
        <View
          style={[styles.menuContainer, { backgroundColor: colors.card }]}
          accessibilityLabel="Quick access shortcuts"
        >
          {quickActions.map((item, index) => (
            <MenuItemComponent
              key={item.label}
              item={item}
              isLast={index === quickActions.length - 1}
              colors={colors}
            />
          ))}
        </View>

        <SectionHeader
          title="Security"
          subtitle="Two-factor, password, privacy"
          icon={<Shield size={ICON_SIZE.base} color={colors.success} />}
        />
        <View style={[styles.card, { backgroundColor: colors.card }]} accessibilityLabel="Security controls">
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
        </View>

        <SectionHeader
          title="Payments"
          subtitle="Mobile money and wallet"
          icon={<CreditCard size={ICON_SIZE.base} color={colors.warning} />}
        />
        <View
          style={[styles.menuContainer, { backgroundColor: colors.card }]}
          accessibilityLabel="Payments and wallet"
        >
          {paymentItems.map((item, index) => (
            <MenuItemComponent
              key={item.label}
              item={item}
              isLast={index === paymentItems.length - 1}
              colors={colors}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: colors.card }]}
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <View style={styles.signOutIcon}>
            <LogOut size={ICON_SIZE.base} color={colors.error} strokeWidth={1.5} />
          </View>
          <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
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
    fontSize: TYPOGRAPHY.fontSize["3xl"],
  },
  headerSubtitle: {
    marginTop: SPACING.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  profileCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: COMPONENT_SIZE.avatar.xl,
    height: COMPONENT_SIZE.avatar.xl,
    borderRadius: COMPONENT_SIZE.avatar.xl / 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["3xl"],
    color: "#FFFFFF",
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
    marginBottom: SPACING.xs,
  },
  profileEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  profilePhone: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
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
    borderRadius: RADIUS.base,
    padding: SPACING.md,
  },
  statLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  engagementGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  engagementCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  engagementHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  engagementIcon: {
    width: COMPONENT_SIZE.avatar.sm,
    height: COMPONENT_SIZE.avatar.sm,
    borderRadius: COMPONENT_SIZE.avatar.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  engagementLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  engagementValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize["2xl"],
  },
  engagementSub: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  dashboardCta: {
    marginBottom: SPACING.xl,
  },
  menuContainer: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: SPACING.xl,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.base,
  },
  menuItemIcon: {
    width: COMPONENT_SIZE.avatar.md,
    height: COMPONENT_SIZE.avatar.md,
    borderRadius: COMPONENT_SIZE.avatar.md / 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.body,
  },
  menuItemSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xxs,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
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
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  securitySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
  },
  signOutButton: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  signOutIcon: {
    width: COMPONENT_SIZE.avatar.md,
    height: COMPONENT_SIZE.avatar.md,
    borderRadius: COMPONENT_SIZE.avatar.md / 2,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.md,
  },
  signOutText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.body,
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
});
