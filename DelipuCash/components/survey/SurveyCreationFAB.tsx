/**
 * Survey Creation FAB (Floating Action Button)
 * Modern radial/expandable FAB with creation options (2026)
 *
 * Features:
 * - Expandable FAB with multiple creation options
 * - Animated expansion with staggered reveals (react-native-reanimated, UI thread)
 * - Scroll-aware auto-hide via parent-driven translateY shared value
 * - Safe-area-aware positioning via bottomOffset prop
 * - Haptic feedback
 * - Backdrop overlay
 * - Accessibility support with proper labels
 * - Options: Blank, Template, Import, Conversational (AI)
 * - Reduced-motion support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  AccessibilityInfo,
  AccessibilityActionEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import {
  Plus,
  FileText,
  LayoutTemplate,
  Upload,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';
import {
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SHADOWS,
  useTheme,
  withAlpha,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export type CreationMode = 'blank' | 'template' | 'import' | 'conversational';

interface SurveyCreationFABProps {
  onSelect: (mode: CreationMode) => void;
  onPrimaryPress?: () => void;
  disabled?: boolean;
  /** Safe-area-aware bottom offset (from parent: insets.bottom + SPACING.lg) */
  bottomOffset?: number;
  /** Parent-driven auto-hide translateY shared value (from scroll handler) */
  translateY?: SharedValue<number>;
}

interface FABOption {
  mode: CreationMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// ============================================================================
// CONSTANTS — matches question screen FAB (56px)
// ============================================================================

const FAB_SIZE = 56;
const OPTION_SIZE = 48;
const FALLBACK_BOTTOM = SPACING.xl + 80; // Legacy fallback when no bottomOffset prop

// ============================================================================
// ANIMATED OPTION ITEM — extracted so each item owns its own useAnimatedStyle
// ============================================================================

interface AnimatedOptionItemProps {
  option: FABOption;
  progress: SharedValue<number>;
  colors: ReturnType<typeof useTheme>['colors'];
  onSelect: (mode: CreationMode) => void;
}

const AnimatedOptionItem: React.FC<AnimatedOptionItemProps> = ({
  option,
  progress,
  colors,
  onSelect,
}) => {
  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [50, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.5, 1]) },
    ],
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.optionWrapper, animStyle]}>
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => onSelect(option.mode)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${option.label}: ${option.description}`}
      >
        <View style={[styles.optionLabel, { backgroundColor: colors.card }]}>
          <Text style={[styles.optionLabelText, { color: colors.text }]}>
            {option.label}
          </Text>
          <Text style={[styles.optionDescText, { color: colors.textMuted }]}>
            {option.description}
          </Text>
        </View>
        <View
          style={[
            styles.optionButton,
            { backgroundColor: option.color },
            SHADOWS.md,
          ]}
        >
          {option.icon}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SurveyCreationFAB: React.FC<SurveyCreationFABProps> = ({
  onSelect,
  onPrimaryPress,
  disabled,
  bottomOffset,
  translateY: parentTranslateY,
}) => {
  const { colors, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const longPressTriggeredRef = useRef(false);

  // Shared values (UI thread)
  const fabRotation = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const scaleAnim = useSharedValue(1);
  const isExpandedSV = useSharedValue(0); // 0 = collapsed, 1 = expanded

  // Per-option animation progress (staggered spring)
  const optionProgress0 = useSharedValue(0);
  const optionProgress1 = useSharedValue(0);
  const optionProgress2 = useSharedValue(0);
  const optionProgress3 = useSharedValue(0);
  const optionAnimations = [optionProgress0, optionProgress1, optionProgress2, optionProgress3];

  // Check reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => listener.remove();
  }, []);

  // Sync React state → shared value for animated style
  useEffect(() => {
    isExpandedSV.value = isExpanded ? 1 : 0;
  }, [isExpanded]);

  const options: FABOption[] = [
    {
      mode: 'blank',
      label: 'Blank Survey',
      icon: <FileText size={22} />,
      color: colors.primary,
      description: 'Start from scratch',
    },
    {
      mode: 'template',
      label: 'Template',
      icon: <LayoutTemplate size={22} />,
      color: colors.success,
      description: 'Use a template',
    },
    {
      mode: 'import',
      label: 'Import File',
      icon: <Upload size={22} />,
      color: colors.warning,
      description: 'JSON, CSV, Excel, TSV',
    },
    {
      mode: 'conversational',
      label: 'AI Builder',
      icon: <MessageSquarePlus size={22} />,
      color: colors.info,
      description: 'Conversational mode',
    },
  ];

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    const duration = reduceMotion ? 0 : 200;

    // FAB rotation
    fabRotation.value = withTiming(newExpanded ? 1 : 0, { duration });

    // Backdrop fade
    backdropOpacity.value = withTiming(newExpanded ? 1 : 0, { duration });

    // Options staggered animation
    if (newExpanded) {
      optionAnimations.forEach((anim, index) => {
        anim.value = reduceMotion
          ? 1
          : withDelay(index * 50, withSpring(1, { stiffness: 80, damping: 8 }));
      });
    } else {
      optionAnimations.forEach((anim) => {
        anim.value = reduceMotion ? 0 : withTiming(0, { duration: 150 });
      });
    }
  }, [isExpanded, reduceMotion]);

  const handleSelect = useCallback((mode: CreationMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Quick scale pulse
    scaleAnim.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    // Collapse all
    setIsExpanded(false);
    fabRotation.value = withTiming(0, { duration: 150 });
    backdropOpacity.value = withTiming(0, { duration: 150 });
    optionAnimations.forEach((anim) => {
      anim.value = withTiming(0, { duration: 100 });
    });

    // Callback after collapse animation settles
    setTimeout(() => onSelect(mode), 160);
  }, [onSelect]);

  const triggerPrimaryAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scaleAnim.value = withSequence(
      withTiming(0.92, { duration: reduceMotion ? 0 : 85 }),
      withTiming(1, { duration: reduceMotion ? 0 : 85 })
    );
    onPrimaryPress?.();
  }, [reduceMotion, onPrimaryPress]);

  const handlePrimaryTap = useCallback(() => {
    if (disabled) return;
    if (isExpanded) {
      toggleExpanded();
      return;
    }
    if (onPrimaryPress) {
      triggerPrimaryAction();
      return;
    }
    toggleExpanded();
  }, [disabled, isExpanded, onPrimaryPress, toggleExpanded, triggerPrimaryAction]);

  const handlePrimaryLongPress = useCallback(() => {
    if (disabled) return;
    longPressTriggeredRef.current = true;
    setTimeout(() => {
      longPressTriggeredRef.current = false;
    }, 350);
    if (!isExpanded) {
      toggleExpanded();
    }
  }, [disabled, isExpanded, toggleExpanded]);

  const handleMainFabPress = useCallback(() => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    handlePrimaryTap();
  }, [handlePrimaryTap]);

  const handleMainFabAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'activate':
        handlePrimaryTap();
        break;
      case 'longpress':
        handlePrimaryLongPress();
        break;
      default:
        break;
    }
  }, [handlePrimaryTap, handlePrimaryLongPress]);

  // ── Animated styles (UI thread) ──

  const fabWrapperAnimatedStyle = useAnimatedStyle(() => {
    // Auto-hide only when collapsed — don't hide during menu interaction
    const scrollTranslateY = parentTranslateY
      ? (isExpandedSV.value === 1 ? 0 : parentTranslateY.value)
      : 0;

    return {
      transform: [
        { scale: scaleAnim.value },
        { translateY: scrollTranslateY },
      ],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const fabRotationAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(fabRotation.value, [0, 1], [0, 45])}deg` },
    ],
  }));

  // Compute positions
  const fabBottom = bottomOffset ?? FALLBACK_BOTTOM;
  const optionsBottom = fabBottom + FAB_SIZE + SPACING.md;

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <Animated.View
          style={[
            styles.backdrop,
            backdropAnimatedStyle,
            {
              backgroundColor: withAlpha('#000000', isDark ? 0.7 : 0.5),
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={toggleExpanded}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Close creation menu"
          />
        </Animated.View>
      )}

      {/* Options Menu */}
      <View
        style={[styles.optionsContainer, { bottom: optionsBottom }]}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        {options.map((option, index) => (
          <AnimatedOptionItem
            key={option.mode}
            option={option}
            progress={optionAnimations[index]}
            colors={colors}
            onSelect={handleSelect}
          />
        ))}
      </View>

      {/* Main FAB */}
      <Animated.View
        style={[
          styles.fabWrapper,
          { bottom: fabBottom },
          fabWrapperAnimatedStyle,
        ]}
      >
        {!isExpanded && !disabled && !!onPrimaryPress && (
          <View
            accessible={false}
            pointerEvents="none"
            style={[
              styles.quickHint,
              {
                backgroundColor: colors.card,
                borderColor: withAlpha(colors.text, 0.12),
              },
              SHADOWS.sm,
            ]}
          >
            <Sparkles size={14} color={colors.primary} />
            <Text style={[styles.quickHintText, { color: colors.textMuted }]}>
              Tap to create, hold for options
            </Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: isExpanded ? colors.error : colors.primary,
              opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
            },
            SHADOWS.lg,
          ]}
          onPress={handleMainFabPress}
          onLongPress={handlePrimaryLongPress}
          delayLongPress={260}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            isExpanded
              ? 'Close creation menu'
              : onPrimaryPress
                ? 'Create survey'
                : 'Open creation menu'
          }
          accessibilityHint={
            isExpanded
              ? 'Double tap to close creation options'
              : onPrimaryPress
                ? 'Double tap to create a blank survey. Long press to view more creation options'
                : 'Double tap to view survey creation options'
          }
          accessibilityState={{ expanded: isExpanded, disabled: !!disabled }}
          accessibilityActions={[
            { name: 'activate', label: onPrimaryPress ? 'Create survey' : 'Toggle creation menu' },
            { name: 'longpress', label: 'Open creation options' },
          ]}
          onAccessibilityAction={handleMainFabAccessibilityAction}
        >
          <Animated.View style={fabRotationAnimatedStyle}>
            <Plus size={28} color={colors.primaryText} strokeWidth={2.5} />
          </Animated.View>
        </Pressable>

        {/* Pulse animation ring when not expanded — pointerEvents="none" is critical
            so the ring doesn't steal touches from the FAB button underneath */}
        {!isExpanded && !disabled && (
          <View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              { borderColor: withAlpha(colors.primary, 0.3) },
            ]}
          />
        )}
      </Animated.View>
    </>
  );
};

// ============================================================================
// COMPACT FAB (Alternative simpler version)
// ============================================================================

interface CompactFABProps {
  onPress: () => void;
  disabled?: boolean;
  hasOptions?: boolean;
  bottomOffset?: number;
}

export const CompactFAB: React.FC<CompactFABProps> = ({
  onPress,
  disabled,
  hasOptions,
  bottomOffset,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useSharedValue(1);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scaleAnim.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    onPress();
  }, [onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.fabWrapper,
        { bottom: bottomOffset ?? FALLBACK_BOTTOM },
        animStyle,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            opacity: disabled ? 0.5 : 1,
          },
          SHADOWS.lg,
        ]}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Create new survey"
      >
        {hasOptions ? (
          <Sparkles size={26} color={colors.primaryText} />
        ) : (
          <Plus size={28} color={colors.primaryText} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// CREATION MODE SELECTOR MODAL (Alternative modal-based approach)
// ============================================================================

interface CreationModeSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (mode: CreationMode) => void;
}

export const CreationModeSelector: React.FC<CreationModeSelectorProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const { colors } = useTheme();
  const slideProgress = useSharedValue(0);

  useEffect(() => {
    slideProgress.value = withSpring(visible ? 1 : 0, { stiffness: 65, damping: 11 });
  }, [visible]);

  const options: FABOption[] = [
    {
      mode: 'blank',
      label: 'Blank Survey',
      icon: <FileText size={24} />,
      color: colors.primary,
      description: 'Start with a fresh canvas and add questions manually',
    },
    {
      mode: 'template',
      label: 'From Template',
      icon: <LayoutTemplate size={24} />,
      color: colors.success,
      description: 'Choose from professionally designed templates',
    },
    {
      mode: 'import',
      label: 'Import Questions',
      icon: <Upload size={24} />,
      color: colors.warning,
      description: 'Import from JSON, CSV, Excel, or TSV files',
    },
    {
      mode: 'conversational',
      label: 'AI-Powered Builder',
      icon: <MessageSquarePlus size={24} />,
      color: colors.info,
      description: 'Build your survey in a conversational flow',
    },
  ];

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(slideProgress.value, [0, 1], [300, 0]) },
    ],
  }));

  if (!visible) return null;

  return (
    <View style={styles.selectorOverlay}>
      <TouchableOpacity
        style={styles.selectorBackdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.selectorSheet,
          { backgroundColor: colors.card },
          sheetAnimStyle,
        ]}
      >
        <View style={[styles.selectorHandle, { backgroundColor: colors.border }]} />
        <Text style={[styles.selectorTitle, { color: colors.text }]}>
          Create New Survey
        </Text>
        <Text style={[styles.selectorSubtitle, { color: colors.textMuted }]}>
          Choose how you&apos;d like to start
        </Text>

        <View style={styles.selectorOptions}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.mode}
              style={[
                styles.selectorOption,
                { backgroundColor: withAlpha(option.color, 0.08), borderColor: withAlpha(option.color, 0.2) },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(option.mode);
                onClose();
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}: ${option.description}`}
            >
              <View style={[styles.selectorIconBg, { backgroundColor: option.color }]}>
                {option.icon}
              </View>
              <View style={styles.selectorOptionContent}>
                <Text style={[styles.selectorOptionLabel, { color: colors.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.selectorOptionDesc, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.selectorCancel, { backgroundColor: withAlpha(colors.text, 0.05) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[styles.selectorCancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Main FAB
  fabWrapper: {
    position: 'absolute',
    right: SPACING.lg,
    zIndex: 1000,
    alignItems: 'flex-end',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  quickHint: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  quickHintText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  pulseRing: {
    position: 'absolute',
    width: FAB_SIZE + 16,
    height: FAB_SIZE + 16,
    borderRadius: (FAB_SIZE + 16) / 2,
    borderWidth: 2,
    bottom: -8,
    right: -8,
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },

  // Options
  optionsContainer: {
    position: 'absolute',
    right: SPACING.lg,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  optionWrapper: {
    marginBottom: SPACING.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionLabel: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  optionLabelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  optionDescText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  optionButton: {
    width: OPTION_SIZE,
    height: OPTION_SIZE,
    borderRadius: OPTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Selector Modal
  selectorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1001,
  },
  selectorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  selectorSheet: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
    ...SHADOWS.xl,
  },
  selectorHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  selectorTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  selectorSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: 'center',
    marginTop: SPACING.xxs,
    marginBottom: SPACING.xl,
  },
  selectorOptions: {
    gap: SPACING.sm,
  },
  selectorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  selectorIconBg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorOptionContent: {
    flex: 1,
  },
  selectorOptionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
  selectorOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  selectorCancel: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  selectorCancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    letterSpacing: -0.2,
  },
});

export default SurveyCreationFAB;
