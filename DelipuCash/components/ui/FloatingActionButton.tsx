/**
 * FloatingActionButton (FAB) Component
 * A reusable expandable floating action button with animated menu
 * 
 * @example
 * ```tsx
 * <FloatingActionButton
 *   actions={[
 *     { icon: <Upload />, label: 'Upload', onPress: handleUpload },
 *     { icon: <Camera />, label: 'Camera', onPress: handleCamera },
 *   ]}
 *   position="bottom-right"
 * />
 * ```
 */

import React, { memo, useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import Reanimated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Plus, Sparkles } from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

/**
 * FAB position options
 */
export type FABPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';

/**
 * Individual action item for the FAB menu
 */
export interface FABAction {
  /** Icon element to display */
  icon: React.ReactElement;
  /** Label text */
  label: string;
  /** Press handler */
  onPress: () => void;
  /** Optional background color for the action */
  color?: string;
  /** Accessibility label (defaults to label) */
  accessibilityLabel?: string;
}

/**
 * Props for the FloatingActionButton component
 */
export interface FloatingActionButtonProps {
  /** Array of action items */
  actions: FABAction[];
  /** Position of the FAB */
  position?: FABPosition;
  /** Main FAB icon (defaults to Plus) */
  mainIcon?: React.ReactElement;
  /** Main FAB icon when expanded (defaults to rotated Plus) */
  expandedIcon?: React.ReactElement;
  /** Main FAB color */
  color?: string;
  /** Whether the FAB starts expanded */
  defaultExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Bottom offset from safe area */
  bottomOffset?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Enable haptic feedback */
  haptic?: boolean;
  /** Accessibility label for main button */
  accessibilityLabel?: string;
  /** Parent-driven auto-hide translateY shared value (from scroll handler) */
  translateY?: SharedValue<number>;
  /** Test ID for testing */
  testID?: string;
}

function FloatingActionButtonComponent({
  actions,
  position = 'bottom-right',
  mainIcon,
  expandedIcon,
  color,
  defaultExpanded = false,
  onExpandedChange,
  bottomOffset = SPACING.lg,
  style,
  haptic = true,
  accessibilityLabel = 'Actions menu',
  translateY,
  testID,
}: FloatingActionButtonProps): React.ReactElement {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const scaleAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const fabColor = color || colors.primary;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: expanded ? 1 : 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: expanded ? 1 : 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [expanded, scaleAnim, rotateAnim]);

  const handleToggle = useCallback(() => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  }, [expanded, haptic, onExpandedChange]);

  const handleActionPress = useCallback(
    (action: FABAction) => {
      if (haptic) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setExpanded(false);
      onExpandedChange?.(false);
      action.onPress();
    },
    [haptic, onExpandedChange]
  );

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const getPositionStyle = (): ViewStyle => {
    const base: ViewStyle = { bottom: bottomOffset };
    switch (position) {
      case 'bottom-left':
        return { ...base, left: SPACING.lg };
      case 'bottom-center':
        return { ...base, alignSelf: 'center' };
      case 'bottom-right':
      default:
        return { ...base, right: SPACING.lg };
    }
  };

  // Scroll hide/show — only translateY, isolated from expand animation
  const scrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY ? (expanded ? 0 : translateY.value) : 0 }],
  }));

  const renderMainIcon = () => {
    if (expanded && expandedIcon) {
      return expandedIcon;
    }
    if (mainIcon) {
      return mainIcon;
    }
    return (
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <Plus size={28} color={colors.primaryText} strokeWidth={2.5} />
      </Animated.View>
    );
  };

  return (
    <Reanimated.View
      style={[styles.wrapper, getPositionStyle(), style, scrollStyle]}
      testID={testID}
    >
      <View style={styles.container}>
        {/* Action items */}
        <Animated.View
          style={[
            styles.actions,
            {
              opacity: scaleAnim,
              transform: [
                { scale: scaleAnim },
                {
                  translateY: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleActionPress(action)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel || action.label}
              style={[
                styles.action,
                {
                  backgroundColor: action.color || colors.card,
                  ...SHADOWS.md,
                },
              ]}
            >
              {action.icon}
              <Text
                style={[
                  styles.actionLabel,
                  { color: action.color ? colors.primaryText : colors.text },
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Quick hint — visible only when collapsed */}
        {!expanded && (
          <View
            accessible={false}
            pointerEvents="none"
            style={[
              styles.hint,
              {
                backgroundColor: colors.card,
                borderColor: withAlpha(colors.text, 0.12),
              },
              SHADOWS.sm,
            ]}
          >
            <Sparkles size={14} color={fabColor} />
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Tap to create, hold for options
            </Text>
          </View>
        )}

        {/* Main FAB button */}
        <Pressable
          onPress={handleToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Close actions menu' : accessibilityLabel
          }
          accessibilityHint={
            expanded
              ? 'Double tap to close the actions menu'
              : 'Double tap to open creation options'
          }
          accessibilityState={{ expanded }}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: fabColor,
              opacity: pressed ? 0.75 : 1,
            },
            SHADOWS.lg,
          ]}
        >
          {renderMainIcon()}
        </Pressable>

        {/* Pulse ring — visible only when collapsed */}
        {!expanded && (
          <View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              { borderColor: withAlpha(fabColor, 0.3) },
            ]}
          />
        )}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 1000,
  },
  container: {
    alignItems: 'flex-end',
  },
  actions: {
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  actionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pulseRing: {
    position: 'absolute',
    width: 56 + 16,
    height: 56 + 16,
    borderRadius: (56 + 16) / 2,
    borderWidth: 2,
    bottom: -8,
    right: -8,
  },
  hint: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  hintText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

export const FloatingActionButton = memo(FloatingActionButtonComponent);
