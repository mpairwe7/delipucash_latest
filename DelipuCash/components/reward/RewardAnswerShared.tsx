/**
 * Shared components for both reward-question/[id].tsx and instant-reward-answer/[id].tsx.
 * Extracted to eliminate ~70% code duplication between the two screens (M14).
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  PartyPopper,
  ShieldCheck,
} from 'lucide-react-native';
import {
  BORDER_WIDTH,
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  type ThemeColors,
  withAlpha,
} from '@/utils/theme';
import { formatCurrency } from '@/services/api';

// ─── Pure utility ─────────────────────────────────────────────────────────────

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

// ─── CountdownTimer ───────────────────────────────────────────────────────────

export interface CountdownTimerProps {
  expiryTime: string;
  colors: { warning: string };
  onExpired?: () => void;
}

export const CountdownTimer = memo(function CountdownTimer({
  expiryTime,
  colors,
  onExpired,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    return Math.max(0, Math.floor((new Date(expiryTime).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    const expiry = new Date(expiryTime).getTime();
    const update = (): void => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) onExpired?.();
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiryTime, onExpired]);

  const isExpired = timeLeft <= 0;

  return (
    <View style={[countdownStyles.timerPill, { backgroundColor: withAlpha(colors.warning, 0.12) }]}>
      <Clock3 size={ICON_SIZE.sm} color={colors.warning} strokeWidth={1.5} />
      <Text style={[countdownStyles.timerText, { color: colors.warning }]}>
        {isExpired ? 'Expired' : formatTime(timeLeft)}
      </Text>
    </View>
  );
});

export const countdownStyles = StyleSheet.create({
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  timerText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

// ─── OptionItem ───────────────────────────────────────────────────────────────

export interface OptionItemProps {
  optionKey: string;
  label: string;
  isSelected: boolean;
  isCorrect: boolean;
  wasSelectedPreviously: boolean;
  isDisabled: boolean;
  onPress: (key: string) => void;
  colors: ThemeColors;
  /** Styles object from the consuming screen (option, optionLeft, radio, optionLabel) */
  screenStyles: {
    option: object;
    optionLeft: object;
    radio: object;
    optionLabel: object;
  };
}

export const OptionItem = memo(function OptionItem({
  optionKey,
  label,
  isSelected,
  isCorrect,
  wasSelectedPreviously,
  isDisabled,
  onPress,
  colors,
  screenStyles,
}: OptionItemProps) {
  const handlePress = useCallback(() => onPress(optionKey), [optionKey, onPress]);

  return (
    <Pressable
      style={[
        screenStyles.option,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: isSelected
            ? withAlpha(colors.primary, 0.08)
            : isDisabled
              ? withAlpha(colors.secondary, 0.5)
              : colors.secondary,
          opacity: isDisabled && !wasSelectedPreviously ? 0.6 : 1,
        },
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      hitSlop={8}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
    >
      <View style={screenStyles.optionLeft}>
        <View
          style={[
            screenStyles.radio,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : 'transparent',
            },
          ]}
        />
        <Text
          style={[
            screenStyles.optionLabel,
            { color: isDisabled && !wasSelectedPreviously ? colors.textMuted : colors.text },
          ]}
        >
          {`${optionKey.toUpperCase()}. ${label}`}
        </Text>
      </View>
      {isCorrect && <CheckCircle2 size={ICON_SIZE.sm} color={colors.success} strokeWidth={1.5} />}
      {wasSelectedPreviously && !isCorrect && (
        <AlertCircle size={ICON_SIZE.sm} color={colors.error} strokeWidth={1.5} />
      )}
    </Pressable>
  );
});

// ─── WinnerRow ────────────────────────────────────────────────────────────────

export interface WinnerRowProps {
  winner: {
    id: string;
    position: number;
    userEmail: string;
    paymentStatus: string;
    amountAwarded: number;
  };
  colors: ThemeColors;
}

export const WinnerRow = memo(function WinnerRow({ winner, colors }: WinnerRowProps) {
  return (
    <View style={[sharedStyles.winnerRow, { borderColor: colors.border }]}>
      <View style={sharedStyles.winnerLeft}>
        <Text style={[sharedStyles.winnerPosition, { color: colors.primary }]}>{winner.position}.</Text>
        <View style={sharedStyles.winnerInfo}>
          <Text style={[sharedStyles.winnerEmail, { color: colors.text }]} numberOfLines={1}>
            {winner.userEmail}
          </Text>
          <Text style={[sharedStyles.winnerStatus, { color: colors.textMuted }]}>
            {winner.paymentStatus}
          </Text>
        </View>
      </View>
      <Text style={[sharedStyles.winnerAmount, { color: colors.success }]}>
        {formatCurrency(winner.amountAwarded)}
      </Text>
    </View>
  );
});

// ─── WinnersSection ───────────────────────────────────────────────────────────

export interface WinnersSectionProps {
  winners: WinnerRowProps['winner'][];
  colors: ThemeColors;
  /** Card style from the consuming screen */
  cardStyle: object;
}

export const WinnersSection = memo(function WinnersSection({
  winners,
  colors,
  cardStyle,
}: WinnersSectionProps) {
  if (!winners || winners.length === 0) return null;

  return (
    <View style={[cardStyle, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sharedStyles.cardHeader}>
        <View style={[sharedStyles.badge, { backgroundColor: withAlpha(colors.info, 0.12) }]}>
          <PartyPopper size={ICON_SIZE.sm} color={colors.info} strokeWidth={1.5} />
          <Text style={[sharedStyles.badgeText, { color: colors.info }]}>Winners</Text>
        </View>
        <Text style={[sharedStyles.cardMeta, { color: colors.textMuted }]}>Latest payouts</Text>
      </View>
      {winners.map((winner) => (
        <WinnerRow key={winner.id} winner={winner} colors={colors} />
      ))}
    </View>
  );
});

// ─── TrustCard ────────────────────────────────────────────────────────────────

export interface TrustCardProps {
  colors: ThemeColors;
  /** Card style from the consuming screen */
  cardStyle: object;
}

export const TrustCard = memo(function TrustCard({ colors, cardStyle }: TrustCardProps) {
  return (
    <View style={[cardStyle, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={sharedStyles.cardHeader}>
        <View style={[sharedStyles.badge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <ShieldCheck size={ICON_SIZE.sm} color={colors.primary} strokeWidth={1.5} />
          <Text style={[sharedStyles.badgeText, { color: colors.primary }]}>Fair play</Text>
        </View>
      </View>
      <View style={sharedStyles.trustRules}>
        <Text style={[sharedStyles.trustRule, { color: colors.textMuted }]}>
          {'\u2022'} One attempt per question — answers are final
        </Text>
        <Text style={[sharedStyles.trustRule, { color: colors.textMuted }]}>
          {'\u2022'} Winners are selected in order of correct submissions
        </Text>
        <Text style={[sharedStyles.trustRule, { color: colors.textMuted }]}>
          {'\u2022'} Payouts are processed automatically via mobile money
        </Text>
        <Text style={[sharedStyles.trustRule, { color: colors.textMuted }]}>
          {'\u2022'} All answers are verified server-side for fairness
        </Text>
      </View>
    </View>
  );
});

// ─── Shared Styles ────────────────────────────────────────────────────────────

const sharedStyles = StyleSheet.create({
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER_WIDTH.hairline,
  },
  winnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  winnerPosition: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 24,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerEmail: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  winnerStatus: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  winnerAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  cardMeta: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  trustRules: {
    gap: SPACING.xs,
  },
  trustRule: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 20,
  },
});
