/**
 * Video Subscription Screen
 *
 * Dedicated screen for Video Premium purchase flow.
 * Hosts InlinePremiumSection in a full-screen context so the video feed
 * remains clean and unobstructed (no z-index overlay conflicts).
 *
 * Navigated to from:
 * - Video feed header "Subscribe" chip (non-premium users)
 * - VideoPremiumPrompt onUpgrade callback
 *
 * @module app/video-subscription
 */

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { ArrowLeft, Upload, Wifi, Camera, Crown } from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import {
  InlinePremiumSection,
  type InlinePremiumSectionRef,
} from '@/components/payment';
import { useVideoPremium } from '@/services/purchasesHooks';

export default function VideoSubscriptionScreen() {
  const { colors, isDark } = useTheme();
  const premiumRef = useRef<InlinePremiumSectionRef>(null);
  const { isPremium, source, remainingDays } = useVideoPremium();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={[styles.backButton, { backgroundColor: withAlpha(colors.text, 0.08) }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Video Premium</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <View style={[styles.heroCard, { backgroundColor: withAlpha(colors.warning, 0.08), borderColor: withAlpha(colors.warning, 0.2) }]}>
          <View style={[styles.heroIcon, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
            <Crown size={28} color={colors.warning} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isPremium ? 'Video Premium Active' : 'Unlock Video Premium'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {isPremium
              ? source === 'ADMIN'
                ? 'Premium access included with your admin role'
                : `${remainingDays} days remaining on your subscription`
              : 'Upload larger videos, livestream longer, and record extended content'}
          </Text>
        </View>

        {/* InlinePremiumSection — full payment flow */}
        <InlinePremiumSection
          ref={premiumRef}
          featureType="VIDEO"
          title="Video Premium"
          accentColor={colors.warning}
          features={[
            { icon: Upload, text: 'Upload videos up to 500 MB' },
            { icon: Wifi, text: 'Livestream up to 2 hours' },
            { icon: Camera, text: 'Record videos up to 30 minutes' },
          ]}
          onPurchaseComplete={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Navigate back after a brief delay to show success state
            setTimeout(() => router.back(), 1200);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  backButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  headerSpacer: {
    width: COMPONENT_SIZE.touchTarget,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING['2xl'],
  },
  heroCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
