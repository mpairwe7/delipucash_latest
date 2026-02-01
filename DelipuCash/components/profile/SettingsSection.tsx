/**
 * SettingsSection Component
 * Collapsible/tabbed settings section with consistent styling
 * 
 * Design: iOS Settings + Material You settings (2025-2026 style)
 * Features:
 * - Grouped settings with headers
 * - Toggle switches with proper accessibility
 * - Navigation items with chevrons
 * - Collapsible sections (optional)
 * 
 * Accessibility: WCAG 2.2 AA compliant
 * - Clear switch state announcements
 * - 44x44dp touch targets
 * - Proper heading structure
 * 
 * @example
 * ```tsx
 * <SettingsSection
 *   title="Security"
 *   icon={<Shield size={18} color={colors.primary} />}
 *   items={[
 *     { type: 'toggle', label: '2FA', value: true, onChange: toggle2FA },
 *     { type: 'navigation', label: 'Change Password', onPress: () => {} },
 *   ]}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Switch,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  RADIUS,
  withAlpha,
  ICON_SIZE,
} from '@/utils/theme';
import { AccessibleText } from './AccessibleText';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type SettingItemType = 'toggle' | 'navigation' | 'action' | 'info' | 'custom';

export interface SettingItem {
  /** Item type */
  type: SettingItemType;
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Icon element */
  icon?: React.ReactNode;
  /** Toggle value (for toggle type) */
  value?: boolean;
  /** Toggle change handler (for toggle type) */
  onChange?: (value: boolean) => void;
  /** Press handler (for navigation/action type) */
  onPress?: () => void;
  /** Info text (for info type) */
  infoText?: string;
  /** Custom content (for custom type) */
  customContent?: React.ReactNode;
  /** Whether item is disabled */
  disabled?: boolean;
  /** Destructive styling (red text) */
  destructive?: boolean;
  /** Badge text (e.g., "Premium") */
  badge?: string;
  /** Badge color */
  badgeColor?: string;
  /** Right-side text (e.g., current value) */
  rightText?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
}

export interface SettingsSectionProps {
  /** Section title */
  title: string;
  /** Section subtitle */
  subtitle?: string;
  /** Section icon */
  icon?: React.ReactNode;
  /** Settings items */
  items: SettingItem[];
  /** Whether section is collapsible */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
  /** Animation delay (ms) */
  animationDelay?: number;
  /** Test ID */
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SettingItemRow({
  item,
  isLast,
}: {
  item: SettingItem;
  isLast: boolean;
}): React.ReactElement | null {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (item.disabled || item.type === 'toggle' || item.type === 'info') return;
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.type, item.disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = useCallback(() => {
    if (item.disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onPress?.();
  }, [item]);

  const handleToggle = useCallback((value: boolean) => {
    if (item.disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onChange?.(value);
  }, [item]);

  const isInteractive = item.type === 'navigation' || item.type === 'action';
  const textColor = item.destructive ? colors.error : colors.text;

  return (
    <AnimatedPressable
      style={[
        styles.itemRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        animatedStyle,
      ]}
      onPressIn={isInteractive ? handlePressIn : undefined}
      onPressOut={isInteractive ? handlePressOut : undefined}
      onPress={isInteractive ? handlePress : undefined}
      disabled={item.disabled || !isInteractive}
      accessible
      accessibilityRole={item.type === 'toggle' ? 'switch' : 'button'}
      accessibilityLabel={item.label}
      accessibilityHint={item.accessibilityHint || (item.type === 'navigation' ? `Navigate to ${item.label}` : undefined)}
      accessibilityState={{
        disabled: item.disabled,
        checked: item.type === 'toggle' ? item.value : undefined,
      }}
    >
      {/* Icon */}
      {item.icon && (
        <View style={[styles.itemIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          {item.icon}
        </View>
      )}

      {/* Content */}
      <View style={styles.itemContent}>
        <View style={styles.itemLabelRow}>
          <AccessibleText
            variant="body"
            customColor={item.disabled ? colors.textDisabled : textColor}
            style={styles.itemLabel}
          >
            {item.label}
          </AccessibleText>

          {item.badge && (
            <View
              style={[
                styles.badge,
                { backgroundColor: withAlpha(item.badgeColor || colors.warning, 0.12) },
              ]}
            >
              <AccessibleText
                variant="caption"
                customColor={item.badgeColor || colors.warning}
              >
                {item.badge}
              </AccessibleText>
            </View>
          )}
        </View>

        {item.subtitle && (
          <AccessibleText
            variant="bodySmall"
            color="textMuted"
            style={styles.itemSubtitle}
          >
            {item.subtitle}
          </AccessibleText>
        )}

        {item.type === 'info' && item.infoText && (
          <AccessibleText
            variant="body"
            color="textSecondary"
            style={styles.infoText}
          >
            {item.infoText}
          </AccessibleText>
        )}

        {item.type === 'custom' && item.customContent}
      </View>

      {/* Right Side */}
      <View style={styles.itemRight}>
        {item.rightText && (
          <AccessibleText variant="bodySmall" color="textMuted" style={styles.rightText}>
            {item.rightText}
          </AccessibleText>
        )}

        {item.type === 'toggle' && (
          <Switch
            value={item.value}
            onValueChange={handleToggle}
            disabled={item.disabled}
            thumbColor={item.value ? colors.primary : colors.border}
            trackColor={{
              false: colors.border,
              true: withAlpha(colors.primary, 0.4),
            }}
            accessibilityLabel={`${item.label} toggle`}
          />
        )}

        {item.type === 'navigation' && (
          <View style={[styles.chevron, { backgroundColor: colors.secondary }]}>
            <ChevronRight size={ICON_SIZE.base} color={colors.textMuted} strokeWidth={2} />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

export function SettingsSection({
  title,
  subtitle,
  icon,
  items,
  collapsible = false,
  initialCollapsed = false,
  animationDelay = 0,
  testID,
}: SettingsSectionProps): React.ReactElement {
  const { colors } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const handleToggleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const ChevronIcon = isCollapsed ? ChevronDown : ChevronUp;

  return (
    <Animated.View
      entering={FadeInDown.delay(animationDelay).duration(400).springify()}
      layout={Layout.springify()}
      style={styles.container}
      testID={testID}
    >
      {/* Section Header */}
      {collapsible ? (
        <TouchableOpacity
          style={styles.header}
          onPress={handleToggleCollapse}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${title} section, ${isCollapsed ? 'collapsed' : 'expanded'}`}
          accessibilityHint="Tap to toggle section"
        >
          <View style={styles.headerContent}>
            {icon && (
              <View style={[styles.headerIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                {icon}
              </View>
            )}
            <View style={styles.headerText}>
              <AccessibleText variant="h4" headingLevel={3}>
                {title}
              </AccessibleText>
              {subtitle && (
                <AccessibleText variant="bodySmall" color="textMuted">
                  {subtitle}
                </AccessibleText>
              )}
            </View>
          </View>
          <ChevronIcon size={ICON_SIZE.lg} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {icon && (
              <View style={[styles.headerIcon, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                {icon}
              </View>
            )}
            <View style={styles.headerText}>
              <AccessibleText variant="h4" headingLevel={3}>
                {title}
              </AccessibleText>
              {subtitle && (
                <AccessibleText variant="bodySmall" color="textMuted">
                  {subtitle}
                </AccessibleText>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Items Container */}
      {(!collapsible || !isCollapsed) && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.itemsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {items.map((item, index) => (
            <SettingItemRow
              key={item.id}
              item={item}
              isLast={index === items.length - 1}
            />
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerText: {
    flex: 1,
  },
  itemsContainer: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    minHeight: 64,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  itemContent: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemLabel: {},
  itemSubtitle: {
    marginTop: SPACING.xxs,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  infoText: {
    marginTop: SPACING.xs,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rightText: {
    marginRight: SPACING.xs,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SettingsSection;
