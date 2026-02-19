/**
 * PremiumBadge — Visual indicator for premium subscribers.
 *
 * Shows a small "Premium" chip with crown icon next to user's name
 * in profile, comments, etc. Returns null if user is not premium.
 *
 * @module components/PremiumBadge
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { usePremiumStatus } from '@/services/purchasesHooks';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

interface PremiumBadgeProps {
  size?: 'sm' | 'md';
}

export const PremiumBadge = memo<PremiumBadgeProps>(({ size = 'sm' }) => {
  const { isPremium, isLoading } = usePremiumStatus();
  const { colors } = useTheme();

  if (isLoading || !isPremium) return null;

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 10 : 14;
  const fontSize = isSmall ? 9 : 11;
  const paddingH = isSmall ? SPACING.xs : SPACING.sm;
  const paddingV = isSmall ? 2 : 4;

  return (
    <View
      accessible
      accessibilityRole="text"
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.warning, 0.15),
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
      accessibilityLabel="Premium subscriber"
    >
      <Crown size={iconSize} color={colors.warning} />
      <Text
        style={[
          styles.text,
          {
            color: colors.warning,
            fontSize,
          },
        ]}
      >
        Premium
      </Text>
    </View>
  );
});

PremiumBadge.displayName = 'PremiumBadge';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: RADIUS.sm,
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default PremiumBadge;
