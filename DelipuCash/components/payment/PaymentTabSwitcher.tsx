/**
 * Payment Tab Switcher Component
 *
 * Animated "Google Play" | "Mobile Money" tab selector for payment method.
 * Follows 2026 glassmorphic pill pattern from the videos tab.
 *
 * @module components/payment/PaymentTabSwitcher
 */

import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CreditCard, Smartphone } from 'lucide-react-native';

import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  BORDER_WIDTH,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export type PaymentTab = 'google_play' | 'mobile_money';

export interface PaymentTabSwitcherProps {
  activeTab: PaymentTab;
  onTabChange: (tab: PaymentTab) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SPRING_CONFIG = { damping: 20, stiffness: 300 };
const MIN_TOUCH_TARGET = 48;

// ============================================================================
// COMPONENT
// ============================================================================

export const PaymentTabSwitcher = React.memo<PaymentTabSwitcherProps>(({
  activeTab,
  onTabChange,
}) => {
  const { colors, isDark } = useTheme();
  const reduceMotion = useReducedMotion();

  // Animated indicator position: 0 = Google Play, 1 = Mobile Money
  const indicatorPos = useSharedValue(activeTab === 'mobile_money' ? 1 : 0);

  useEffect(() => {
    const target = activeTab === 'mobile_money' ? 1 : 0;
    indicatorPos.value = reduceMotion
      ? target
      : withSpring(target, SPRING_CONFIG);
  }, [activeTab, indicatorPos, reduceMotion]);

  const handleTabPress = useCallback((tab: PaymentTab) => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AccessibilityInfo.announceForAccessibility(
      tab === 'google_play' ? 'Showing Google Play plans' : 'Showing Mobile Money plans'
    );
    onTabChange(tab);
  }, [activeTab, onTabChange]);

  // Sliding pill indicator
  const indicatorStyle = useAnimatedStyle(() => ({
    left: `${indicatorPos.value * 50}%` as any,
  }));

  // Active/inactive text colors
  const gpTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indicatorPos.value,
      [0, 1],
      [isDark ? '#FFFFFF' : '#000000', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)']
    ),
  }));

  const mmTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      indicatorPos.value,
      [0, 1],
      [isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', isDark ? '#FFFFFF' : '#000000']
    ),
  }));

  const containerBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const pillBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)';

  return (
    <View
      role="tablist"
      accessibilityLabel="Payment method tabs"
      style={[styles.container, { backgroundColor: containerBg, borderColor: withAlpha(colors.border, 0.3) }]}
    >
      {/* Animated sliding pill */}
      <Animated.View style={[styles.indicator, { backgroundColor: pillBg }, indicatorStyle]} />

      {/* Google Play Tab */}
      <Pressable
        style={styles.tab}
        onPress={() => handleTabPress('google_play')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'google_play' }}
        accessibilityLabel="Google Play"
        accessibilityHint="Pay with credit card, debit card, or carrier billing"
      >
        <CreditCard
          size={16}
          color={activeTab === 'google_play' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[styles.tabText, gpTextStyle]}>
          Google Play
        </Animated.Text>
      </Pressable>

      {/* Mobile Money Tab */}
      <Pressable
        style={styles.tab}
        onPress={() => handleTabPress('mobile_money')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'mobile_money' }}
        accessibilityLabel="Mobile Money"
        accessibilityHint="Pay with MTN or Airtel mobile money"
      >
        <Smartphone
          size={16}
          color={activeTab === 'mobile_money' ? colors.text : withAlpha(colors.text, 0.45)}
          strokeWidth={2}
        />
        <Animated.Text style={[styles.tabText, mmTextStyle]}>
          Mobile Money
        </Animated.Text>
      </Pressable>
    </View>
  );
});

PaymentTabSwitcher.displayName = 'PaymentTabSwitcher';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: BORDER_WIDTH.thin,
    padding: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '50%',
    borderRadius: RADIUS.lg - 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    minHeight: MIN_TOUCH_TARGET,
    zIndex: 1,
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});
