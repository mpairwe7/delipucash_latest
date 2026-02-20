/**
 * PostQuestionAdSlot — Post-Answer Native Ad Component
 *
 * Shown after a user submits an answer (reward question, instant reward, or Q&A).
 * Appears at natural break points only — never during active answering.
 *
 * 2026 Best Practices:
 * - FadeIn animation with subtle haptic on appearance
 * - "Sponsored" pill with glassmorphism styling
 * - "Why this ad?" feedback link via AdFeedbackModal
 * - WCAG 2.2 AA accessibility (labels, roles, reduced-motion support, 44dp touch targets)
 * - Frequency-capped via useQuizAdPlacement (1 ad per 3 questions)
 * - Premium users see nothing (gated upstream)
 * - Renders null when no ad or frequency cap blocks
 * - Impression guard resets when ad changes (no double-tracking)
 *
 * Inspired by: Duolingo lesson-end ads, Kahoot! between-round ads
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { Info, X } from 'lucide-react-native';
import { SmartAd } from './AdComponent';
import { AdFeedbackModal } from './AdFeedbackModal';
import { triggerHaptic } from '@/utils/quiz-utils';
import {
  BORDER_WIDTH,
  COMPONENT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  useTheme,
  withAlpha,
} from '@/utils/theme';
import type { Ad } from '@/types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PostQuestionAdSlotProps {
  /** The ad to display (null = render nothing) */
  ad: Ad | null;
  /** Called when ad impression is tracked */
  onImpression?: () => void;
  /** Called when user clicks the ad */
  onAdClick?: (ad: Ad) => void;
  /** Called when user dismisses the ad */
  onDismiss?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const PostQuestionAdSlot = memo(function PostQuestionAdSlot({
  ad,
  onImpression,
  onAdClick,
  onDismiss,
}: PostQuestionAdSlotProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const impressionTrackedForRef = useRef<string | null>(null);

  // Track impression once per unique ad (resets when ad.id changes)
  useEffect(() => {
    if (ad && impressionTrackedForRef.current !== ad.id) {
      impressionTrackedForRef.current = ad.id;
      // Subtle haptic on ad appearance (not jarring)
      if (!reducedMotion) {
        triggerHaptic('light');
      }
      onImpression?.();

      // Accessibility announcement
      AccessibilityInfo.announceForAccessibility('Sponsored content loaded below your answer');
    }
  }, [ad, onImpression, reducedMotion]);

  const handleDismiss = useCallback(() => {
    // Respect reduced-motion preference for dismiss haptic
    if (!reducedMotion) {
      triggerHaptic('light');
    }
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss, reducedMotion]);

  const handleWhyThisAd = useCallback(() => {
    if (!reducedMotion) {
      triggerHaptic('light');
    }
    setShowFeedback(true);
  }, [reducedMotion]);

  const handleCloseFeedback = useCallback(() => {
    setShowFeedback(false);
  }, []);

  const handleAdClick = useCallback((clickedAd: Ad) => {
    triggerHaptic('medium');
    onAdClick?.(clickedAd);
  }, [onAdClick]);

  // Render nothing if no ad, dismissed, or frequency-capped upstream
  if (!ad || dismissed) return null;

  const enteringAnimation = reducedMotion
    ? FadeIn.duration(0)
    : FadeIn.delay(400).duration(300);

  const exitingAnimation = reducedMotion
    ? FadeOut.duration(0)
    : FadeOut.duration(200);

  return (
    <>
      <Animated.View
        entering={enteringAnimation}
        exiting={exitingAnimation}
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.border, 0.6),
          },
        ]}
        accessible={true}
        accessibilityRole="none"
        accessibilityLabel="Sponsored content"
      >
        {/* Sponsored header row */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.sponsoredPill,
              { backgroundColor: withAlpha(colors.textMuted, 0.1) },
            ]}
          >
            <Text style={[styles.sponsoredText, { color: colors.textMuted }]}>
              Sponsored
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleWhyThisAd}
              hitSlop={16}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Why am I seeing this ad?"
              accessibilityHint="Opens feedback about this advertisement"
            >
              <Info size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
            </Pressable>
            <Pressable
              onPress={handleDismiss}
              hitSlop={16}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Hide this ad"
            >
              <X size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={1.5} />
            </Pressable>
          </View>
        </View>

        {/* Ad content */}
        <SmartAd
          ad={ad}
          onAdClick={handleAdClick}
          style={styles.adContent}
        />
      </Animated.View>

      {/* Ad Feedback Modal */}
      {showFeedback && (
        <AdFeedbackModal
          visible={showFeedback}
          onClose={handleCloseFeedback}
          ad={ad}
          onFeedback={handleDismiss}
        />
      )}
    </>
  );
});

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sponsoredPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: RADIUS.full,
  },
  sponsoredText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  iconButton: {
    // WCAG 2.2 AA minimum 44dp touch target
    minWidth: COMPONENT_SIZE.touchTarget,
    minHeight: COMPONENT_SIZE.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adContent: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
});
