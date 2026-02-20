/**
 * Video Premium Upgrade Prompt
 *
 * Shown when a user tries to perform an action that exceeds their free-tier limits
 * (e.g., uploading a file >40MB, starting a livestream >5min).
 *
 * Follows 2026 paywall UX best practices:
 * - Benefit-driven messaging (what they gain, not what they lack)
 * - Clear comparison of free vs. premium limits
 * - Single action CTA routing to the subscription screen
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Upload, Wifi, Video, X } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

interface VideoPremiumPromptProps {
  /** What the user tried to do (e.g., "upload a 120MB video") */
  action?: string;
  /** Called when the user dismisses the prompt */
  onDismiss?: () => void;
  /** Called when the user taps upgrade; if omitted, navigates to /(tabs)/videos-new */
  onUpgrade?: () => void;
}

export const VideoPremiumPrompt: React.FC<VideoPremiumPromptProps> = ({
  action,
  onDismiss,
  onUpgrade,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const features = [
    { icon: Upload, text: 'Upload videos up to 500 MB' },
    { icon: Wifi, text: 'Livestream up to 2 hours' },
    { icon: Video, text: 'Record videos up to 30 minutes' },
  ];

  return (
    <View style={[styles.container, {
      backgroundColor: colors.card,
      borderColor: withAlpha(colors.warning, 0.3),
    }]}>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          style={styles.dismissButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <X size={20} color={colors.textMuted} />
        </Pressable>
      )}

      <View style={[styles.iconContainer, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
        <Crown size={28} color={colors.warning} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Upgrade to Video Premium
      </Text>

      {action && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          To {action}, you need a premium subscription.
        </Text>
      )}

      <View style={styles.features}>
        {features.map(({ icon: Icon, text }) => (
          <View key={text} style={styles.featureRow}>
            <Icon size={16} color={colors.success} />
            <Text style={[styles.featureText, { color: colors.text }]}>{text}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => {
          if (onUpgrade) {
            onUpgrade();
          } else {
            router.push('/(tabs)/videos-new');
          }
        }}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: colors.warning, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Video Premium"
      >
        <Text style={styles.ctaText}>Upgrade Now</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  dismissButton: {
    position: 'absolute',
    top: SPACING.base,
    right: SPACING.base,
    zIndex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.base,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  features: {
    alignSelf: 'stretch',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    flex: 1,
  },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: SPACING.base,
    borderRadius: RADIUS.base,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
});

export default VideoPremiumPrompt;
