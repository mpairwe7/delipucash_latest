/**
 * SessionSummaryAd — Compact Ad for Session Summary / Result Modals
 *
 * Shown inside session summary overlays between stats and CTA buttons.
 * Uses a compact banner format to avoid dominating the modal content.
 *
 * 2026 Best Practices:
 * - Compact format (BannerAd) — fits inside modal without feeling intrusive
 * - Subtle FadeIn (delayed after stats render) with light haptic
 * - "Sponsored" divider label (Duolingo/YouTube style)
 * - WCAG 2.2 AA: accessible labels, reduced-motion support
 * - Impression guard resets when ad changes (no double-tracking)
 * - Premium users see nothing (gated upstream)
 * - At most 1 ad per session summary
 *
 * Inspired by: Duolingo lesson summary interstitial, Kahoot! result screen
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SmartAd } from './AdComponent';
import { triggerHaptic } from '@/utils/quiz-utils';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import type { Ad } from '@/types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface SessionSummaryAdProps {
  /** The ad to display (null = render nothing) */
  ad: Ad | null;
  /** Called when ad impression is tracked */
  onImpression?: () => void;
  /** Called when user clicks the ad */
  onAdClick?: (ad: Ad) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SessionSummaryAd = memo(function SessionSummaryAd({
  ad,
  onImpression,
  onAdClick,
}: SessionSummaryAdProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const impressionTrackedForRef = useRef<string | null>(null);

  // Track impression once per unique ad
  useEffect(() => {
    if (ad && impressionTrackedForRef.current !== ad.id) {
      impressionTrackedForRef.current = ad.id;
      if (!reducedMotion) {
        triggerHaptic('light');
      }
      onImpression?.();
      AccessibilityInfo.announceForAccessibility('Sponsored content in session summary');
    }
  }, [ad, onImpression, reducedMotion]);

  const handleAdClick = useCallback((clickedAd: Ad) => {
    triggerHaptic('medium');
    onAdClick?.(clickedAd);
  }, [onAdClick]);

  if (!ad) return null;

  const enteringAnimation = reducedMotion
    ? FadeIn.duration(0)
    : FadeIn.delay(600).duration(300);

  return (
    <Animated.View
      entering={enteringAnimation}
      style={styles.container}
      accessible={true}
      accessibilityRole="none"
      accessibilityLabel="Sponsored content"
    >
      {/* Sponsored divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>Sponsored</Text>
        <View style={[styles.dividerLine, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
      </View>

      {/* Ad content — compact format */}
      <View
        style={[
          styles.adWrapper,
          {
            backgroundColor: withAlpha(colors.card, 0.8),
            borderColor: withAlpha(colors.border, 0.4),
          },
        ]}
      >
        <SmartAd
          ad={ad}
          onAdClick={handleAdClick}
          style={styles.adContent}
        />
      </View>
    </Animated.View>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: BORDER_WIDTH.hairline,
  },
  dividerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  adWrapper: {
    borderRadius: RADIUS.md,
    borderWidth: BORDER_WIDTH.hairline,
    overflow: 'hidden',
  },
  adContent: {
    borderRadius: RADIUS.md,
  },
});
