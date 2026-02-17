/**
 * QuickActionsGrid Component
 * Grid of quick action cards for primary profile actions
 *
 * Design: Instagram + Cash App + TikTok quick actions (2025-2026 style)
 * Features:
 * - Responsive 2-column grid measured via onLayout (not screen width)
 * - 3-tier responsive scaling: compact / normal / spacious
 * - Spring press animations with haptic feedback
 * - Badge support for notifications
 * - Admin-only item filtering
 * - Subscription gating for premium features
 *
 * Accessibility: WCAG 2.2 AA compliant
 * - 44x44dp minimum touch targets
 * - Clear accessibilityLabel and accessibilityHint
 * - Proper focus order
 *
 * @example
 * ```tsx
 * <QuickActionsGrid
 *   items={quickActions}
 *   isAdmin={false}
 *   hasSubscription={true}
 *   onSubscriptionRequired={() => showSubscriptionModal()}
 * />
 * ```
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import { Href, router } from 'expo-router';
import { LucideIcon, Lock } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

const GRID_GAP = SPACING.sm; // 8px between cards

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ProfileQuickAction {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Optional description */
  description?: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Icon color */
  iconColor: string;
  /** Icon background color */
  iconBgColor: string;
  /** Route to navigate to */
  route?: string;
  /** Custom press handler (overrides route) */
  onPress?: () => void;
  /** Notification badge count */
  badge?: number;
  /** Only visible to admin users */
  adminOnly?: boolean;
  /** Requires subscription for non-admin users */
  requiresSubscription?: boolean;
  /** Custom accessibility hint */
  accessibilityHint?: string;
  /** Whether item is disabled */
  disabled?: boolean;
}

export interface QuickActionsGridProps {
  /** Array of quick action items */
  items: ProfileQuickAction[];
  /** Whether current user is admin */
  isAdmin?: boolean;
  /** Whether user has active subscription */
  hasSubscription?: boolean;
  /** Handler when subscription is required */
  onSubscriptionRequired?: () => void;
  /** Container style */
  style?: ViewStyle;
  /** Number of columns (always 2) */
  columns?: 2;
  /** Test ID prefix */
  testID?: string;
}

// ============================================================================
// RESPONSIVE SIZING — 3-tier scale based on measured card width
// ============================================================================

/** Responsive dimensions derived from the actual card width */
interface CardDimensions {
  iconBoxSize: number;
  iconSize: number;
  cardPadding: number;
  minHeight: number;
  titleFontSize: number;
  showDescription: boolean;
}

/**
 * Compute card inner dimensions from measured card width.
 * Three tiers ensure graceful scaling from 320px phones to 768px+ tablets.
 *
 *   compact  (cardWidth < 140)  — 320px SE-class phones
 *   normal   (140 ≤ cw < 190)  — 375-428px standard phones
 *   spacious (cw ≥ 190)        — large phones & tablets
 */
function getCardDimensions(cardWidth: number): CardDimensions {
  if (cardWidth < 140) {
    // Compact — squeeze everything while keeping 44dp touch target
    return {
      iconBoxSize: 40,
      iconSize: ICON_SIZE.base,    // 18
      cardPadding: SPACING.sm,     // 8
      minHeight: 88,
      titleFontSize: TYPOGRAPHY.fontSize.xs, // 10
      showDescription: false,
    };
  }
  if (cardWidth < 190) {
    // Normal — standard phone layout
    return {
      iconBoxSize: 46,
      iconSize: ICON_SIZE.lg,      // 20
      cardPadding: SPACING.md,     // 12
      minHeight: 100,
      titleFontSize: TYPOGRAPHY.fontSize.sm, // 12
      showDescription: false,
    };
  }
  // Spacious — large phones & tablets
  return {
    iconBoxSize: 52,
    iconSize: ICON_SIZE.xl,        // 24
    cardPadding: SPACING.base,     // 16
    minHeight: 112,
    titleFontSize: TYPOGRAPHY.fontSize.base, // 14
    showDescription: true,
  };
}

// ============================================================================
// QUICK ACTION CARD
// ============================================================================

interface QuickActionCardProps {
  item: ProfileQuickAction;
  index: number;
  isAdmin: boolean;
  hasSubscription: boolean;
  onSubscriptionRequired?: () => void;
  cardWidth: number;
  dims: CardDimensions;
}

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.8,
};

function QuickActionCard({
  item,
  index,
  isAdmin,
  hasSubscription,
  onSubscriptionRequired,
  cardWidth,
  dims,
}: QuickActionCardProps): React.ReactElement | null {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const Icon = item.icon;
  const isLocked = item.requiresSubscription && !isAdmin && !hasSubscription;
  const isHidden = item.adminOnly && !isAdmin;

  const animatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(pressed.value, [0, 1], [0.08, 0.03]);
    return {
      transform: [{ scale: scale.value }],
      shadowOpacity,
    };
  });

  const handlePressIn = useCallback(() => {
    if (item.disabled) return;
    scale.value = withSpring(0.95, SPRING_CONFIG);
    pressed.value = withSpring(1, SPRING_CONFIG);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
    pressed.value = withSpring(0, SPRING_CONFIG);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = useCallback(() => {
    if (item.disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Check if subscription is required
    if (isLocked) {
      onSubscriptionRequired?.();
      return;
    }

    // Execute custom handler or navigate
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route as Href);
    }
  }, [item, isLocked, onSubscriptionRequired]);

  // Skip rendering if admin only and not admin
  if (isHidden) return null;

  const { iconBoxSize, iconSize, cardPadding, minHeight, titleFontSize, showDescription } = dims;

  // Stagger animation delay — cap at 8 items to avoid long delays
  const animationDelay = 100 + Math.min(index, 7) * 50;

  return (
    <Animated.View
      entering={FadeInDown.delay(animationDelay).duration(400).springify().reduceMotion(ReduceMotion.System)}
      style={[styles.cardWrapper, { width: cardWidth }]}
    >
      <AnimatedPressable
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.border, 0.6),
            padding: cardPadding,
            minHeight,
          },
          item.disabled && styles.cardDisabled,
          animatedStyle,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={item.disabled}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          isLocked
            ? `${item.title}, requires subscription`
            : item.title
        }
        accessibilityHint={
          item.accessibilityHint ||
          (isLocked
            ? 'Subscribe to unlock this feature'
            : item.route
            ? `Navigate to ${item.title}`
            : `Open ${item.title}`)
        }
        accessibilityState={{ disabled: item.disabled }}
      >
        {/* Icon Container */}
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isLocked ? withAlpha(colors.textMuted, 0.1) : item.iconBgColor,
              width: iconBoxSize,
              height: iconBoxSize,
              borderRadius: iconBoxSize / 2,
            },
          ]}
        >
          {isLocked ? (
            <Lock size={iconSize} color={colors.textMuted} strokeWidth={1.5} />
          ) : (
            <Icon size={iconSize} color={item.iconColor} strokeWidth={1.5} />
          )}

          {/* Badge */}
          {!isLocked && item.badge !== undefined && item.badge > 0 && (
            <View style={[styles.badge, { borderColor: colors.card }]}>
              <Text style={styles.badgeText}>
                {item.badge > 99 ? '99+' : item.badge}
              </Text>
            </View>
          )}
        </View>

        {/* Title — font size scales with card width */}
        <Text
          style={[
            styles.title,
            {
              fontSize: titleFontSize,
              fontFamily: TYPOGRAPHY.fontFamily.medium,
              color: isLocked ? colors.textMuted : colors.text,
              lineHeight: titleFontSize * 1.3,
            },
          ]}
          numberOfLines={2}
          allowFontScaling
          maxFontSizeMultiplier={1.3}
        >
          {item.title}
        </Text>

        {/* Description (only on spacious layouts to prevent overflow) */}
        {item.description && showDescription && (
          <AccessibleText
            variant="caption"
            center
            color="textMuted"
            numberOfLines={1}
          >
            {item.description}
          </AccessibleText>
        )}

        {/* Locked indicator */}
        {isLocked && (
          <View style={[styles.lockedOverlay, { backgroundColor: withAlpha(colors.background, 0.7) }]}>
            <Lock size={ICON_SIZE.sm} color={colors.textMuted} />
            <AccessibleText variant="caption" color="textMuted">
              Premium
            </AccessibleText>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

// ============================================================================
// GRID COMPONENT
// ============================================================================

export function QuickActionsGrid({
  items,
  isAdmin = false,
  hasSubscription = false,
  onSubscriptionRequired,
  style,
  columns = 2,
  testID,
}: QuickActionsGridProps): React.ReactElement {
  // Measure actual container width via onLayout — this accounts for ALL
  // parent padding (FlatList paddingHorizontal, sectionContainer margins, etc.)
  // instead of guessing from screen width with phantom GRID_PADDING offsets.
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Only update if the width actually changed (avoids layout loops)
    setContainerWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
  }, []);

  // Card width from measured container — always a clean 2-column fit
  const cardWidth = useMemo(() => {
    if (containerWidth === 0) return 0; // Not measured yet
    const totalGaps = GRID_GAP * (columns - 1);
    return Math.floor((containerWidth - totalGaps) / columns);
  }, [containerWidth, columns]);

  // Responsive dimensions derived from actual card width
  const dims = useMemo(() => getCardDimensions(cardWidth), [cardWidth]);

  // Filter visible items for rendering
  const visibleItems = useMemo(() => {
    return items.filter(item => !item.adminOnly || isAdmin);
  }, [items, isAdmin]);

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="grid"
      onLayout={handleLayout}
    >
      {containerWidth > 0 && (
        <View style={styles.grid}>
          {visibleItems.map((item, index) => (
            <QuickActionCard
              key={item.id}
              item={item}
              index={index}
              isAdmin={isAdmin}
              hasSubscription={hasSubscription}
              onSubscriptionRequired={onSubscriptionRequired}
              cardWidth={cardWidth}
              dims={dims}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Width determined by parent — onLayout measures the actual available space
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cardWrapper: {
    // Width set dynamically from measured container
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.sm,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 10,
    color: '#FFF',
  },
  title: {
    textAlign: 'center',
    paddingHorizontal: SPACING.xs,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
});

export default QuickActionsGrid;
