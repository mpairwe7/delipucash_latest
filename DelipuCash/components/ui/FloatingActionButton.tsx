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
  TouchableOpacity,
  StyleSheet,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  Z_INDEX,
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
  bottomOffset = SPACING.xl,
  style,
  haptic = true,
  accessibilityLabel = 'Actions menu',
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
        return { ...base, left: SPACING.base };
      case 'bottom-center':
        return { ...base, alignSelf: 'center' };
      case 'bottom-right':
      default:
        return { ...base, right: SPACING.base };
    }
  };

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
    <View
      style={[styles.wrapper, getPositionStyle(), style]}
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

        {/* Main FAB button */}
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded }}
          style={[
            styles.fab,
            {
              backgroundColor: fabColor,
              ...SHADOWS.lg,
            },
          ]}
        >
          {renderMainIcon()}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: Z_INDEX.sticky,
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
  },
});

export const FloatingActionButton = memo(FloatingActionButtonComponent);
