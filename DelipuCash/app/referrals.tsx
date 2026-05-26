/**
 * Referrals screen — share the user's referral code, see invite stats.
 *
 * Reachable from Profile → Referrals (added in profile-new.tsx) and from
 * any "Invite friends" CTA. Mirrors the Cash App / Wise referral patterns:
 * a hero card with the code, a one-tap share button, and a small stats grid.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Copy, Gift, Share2, Users } from 'lucide-react-native';

import { useReferralStats } from '@/services/authHooks';
import { useToast } from '@/components/ui/Toast';
import {
  COMPONENT_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import * as Haptics from '@/utils/haptics';

export default function ReferralsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { data, isLoading, isError, refetch } = useReferralStats(true);

  const handleCopy = useCallback(async () => {
    if (!data?.shareUrl) return;
    Haptics.selection();
    await Clipboard.setStringAsync(data.shareUrl);
    showToast({ message: 'Invite link copied', type: 'success' });
  }, [data?.shareUrl, showToast]);

  const handleShare = useCallback(async () => {
    if (!data?.shareUrl) return;
    Haptics.selection();
    try {
      await Share.share({
        message: `Earn real cash on DelipuCash — answer questions, watch videos, and cash out to MTN/Airtel. Sign up with my code ${data.code} to start with a head-start: ${data.shareUrl}`,
      });
    } catch {
      // user dismissed share sheet — no toast needed
    }
  }, [data?.shareUrl, data?.code]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          hitSlop={12}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Refer & earn</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : isError || !data ? (
          <View style={styles.loading}>
            <Text style={[styles.errorText, { color: colors.error }]}>Could not load your invite code.</Text>
            <Pressable
              onPress={() => refetch()}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: SPACING.md }]}
            >
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: withAlpha(colors.primary, 0.12),
                  borderColor: withAlpha(colors.primary, 0.3),
                },
              ]}
              accessibilityRole="header"
            >
              <View style={[styles.iconBubble, { backgroundColor: withAlpha(colors.primary, 0.2) }]}>
                <Gift size={28} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                Earn 500 points each
              </Text>
              <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
                When a friend signs up with your code and completes their first
                successful withdrawal, both of you get a 500-point bonus.
              </Text>

              <View
                style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Text style={[styles.codeLabel, { color: colors.textMuted }]}>YOUR CODE</Text>
                <Text style={[styles.code, { color: colors.text }]} accessibilityLabel={`Your referral code is ${data.code}`}>
                  {data.code}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={handleCopy}
                  style={[styles.secondaryBtn, { borderColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite link"
                >
                  <Copy size={18} color={colors.primary} />
                  <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Copy link</Text>
                </Pressable>
                <Pressable
                  onPress={handleShare}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite"
                >
                  <Share2 size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Share</Text>
                </Pressable>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your invites</Text>
            <View style={styles.statsGrid}>
              <StatTile
                icon={<Users size={18} color={colors.warning} />}
                label="Pending"
                value={data.pending.count}
                color={colors.warning}
                colors={colors}
              />
              <StatTile
                icon={<Users size={18} color={colors.success} />}
                label="Qualified"
                value={data.qualified.count}
                color={colors.success}
                colors={colors}
              />
              <StatTile
                icon={<Gift size={18} color={colors.primary} />}
                label="Bonus pts"
                value={data.qualified.points + data.paid.points}
                color={colors.primary}
                colors={colors}
              />
            </View>

            <View
              style={[styles.howCard, { backgroundColor: colors.elevated, borderColor: colors.border }]}
            >
              <Text style={[styles.howTitle, { color: colors.text }]}>How it works</Text>
              <Text style={[styles.howStep, { color: colors.textSecondary }]}>
                1. Share your invite link with friends in Uganda.
              </Text>
              <Text style={[styles.howStep, { color: colors.textSecondary }]}>
                2. They sign up using your code (auto-applied via the link).
              </Text>
              <Text style={[styles.howStep, { color: colors.textSecondary }]}>
                3. When they complete their first successful withdrawal, both of you receive 500 points.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const StatTile = React.memo(function StatTile({ icon, label, value, color, colors }: StatTileProps) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: withAlpha(color, 0.12) }]}>{icon}</View>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    height: COMPONENT_SIZE.header.standard,
  },
  backBtn: { padding: SPACING.xs },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING['3xl'], gap: SPACING.lg },
  loading: { paddingVertical: SPACING['4xl'], alignItems: 'center' },
  errorText: { fontFamily: TYPOGRAPHY.fontFamily.regular, fontSize: TYPOGRAPHY.fontSize.base },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
    alignItems: 'center',
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    textAlign: 'center',
  },
  heroBody: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
    lineHeight: 22,
  },
  codeBox: {
    width: '100%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  codeLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    letterSpacing: 1,
  },
  code: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    letterSpacing: 4,
  },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minHeight: COMPONENT_SIZE.button.medium,
  },
  secondaryBtnText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: COMPONENT_SIZE.button.medium,
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.sm,
  },
  statsGrid: { flexDirection: 'row', gap: SPACING.sm },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  tileLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  howCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  howTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.xs,
  },
  howStep: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 22,
  },
});
