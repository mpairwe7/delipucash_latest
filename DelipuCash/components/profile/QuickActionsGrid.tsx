/**
 * QuickActionsGrid Component
 * Grid of quick action cards for primary profile actions
 * 
 * Design: Instagram + Cash App + TikTok quick actions (2025-2026 style)
 * Features:
 * - Responsive 2-column grid with proper gutters
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

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ViewStyle,
  Platform,
} from 'react-native';
import { Href, router } from 'expo-router';
import { LucideIcon, Lock } from 'lucide-react-native';
import Animated, {
  FadeInDown,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Responsive breakpoints for future use
// const isSmallScreen = SCREEN_WIDTH < 375;
// const isTablet = SCREEN_WIDTH >= 768;

// Calculate card dimensions for 2-column grid
const GRID_GAP = SPACING.sm;
const GRID_PADDING = SPACING.base;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

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
  /** Number of columns (2 or 3) */
  columns?: 2 | 3;
  /** Test ID prefix */
  testID?: string;
}

interface QuickActionCardProps {
  item: ProfileQuickAction;
  index: number;
  isAdmin: boolean;
  hasSubscription: boolean;
  onSubscriptionRequired?: () => void;
  columns: number;
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
  columns,
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

  // Calculate card width based on columns
  const cardWidth = columns === 3
    ? (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3
    : CARD_WIDTH;

  // Stagger animation delay
  const animationDelay = 100 + index * 50;

  return (
    <Animated.View
      entering={FadeInDown.delay(animationDelay).duration(400).springify()}
      style={[styles.cardWrapper, { width: cardWidth }]}
    >
      <AnimatedPressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
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
            { backgroundColor: isLocked ? withAlpha(colors.textMuted, 0.1) : item.iconBgColor },
          ]}
        >
          {isLocked ? (
            <Lock size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={1.5} />
          ) : (
            <Icon size={ICON_SIZE.lg} color={item.iconColor} strokeWidth={1.5} />
          )}

          {/* Badge */}
          {!isLocked && item.badge !== undefined && item.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.badge > 99 ? '99+' : item.badge}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <AccessibleText
          variant="bodySmall"
          medium
          center
          color={isLocked ? 'textMuted' : 'text'}
          numberOfLines={2}
          style={styles.title}
        >
          {item.title}
        </AccessibleText>

        {/* Description (optional) */}
        {item.description && (
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

export function QuickActionsGrid({
  items,
  isAdmin = false,
  hasSubscription = false,
  onSubscriptionRequired,
  style,
  columns = 2,
  testID,
}: QuickActionsGridProps): React.ReactElement {
  // Filter visible items for rendering
  const visibleItems = useMemo(() => {
    return items.filter(item => !item.adminOnly || isAdmin);
  }, [items, isAdmin]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.grid}>
        {visibleItems.map((item, index) => (
          <QuickActionCard
            key={item.id}
            item={item}
            index={index}
            isAdmin={isAdmin}
            hasSubscription={hasSubscription}
            onSubscriptionRequired={onSubscriptionRequired}
            columns={columns}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cardWrapper: {
    // Width set dynamically
  },
  card: {
    aspectRatio: 1.1,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.sm,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    borderColor: '#FFF',
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 10,
    color: '#FFF',
  },
  title: {
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
