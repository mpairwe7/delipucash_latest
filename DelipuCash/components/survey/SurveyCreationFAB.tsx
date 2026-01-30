/**
 * Survey Creation FAB (Floating Action Button)
 * Modern radial/expandable FAB with creation options (2025/2026)
 * 
 * Features:
 * - Expandable FAB with multiple creation options
 * - Animated expansion with staggered reveals
 * - Haptic feedback
 * - Backdrop blur effect
 * - Accessibility support with proper labels
 * - Options: Blank, Template, Import, Conversational (AI)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import {
  Plus,
  FileText,
  LayoutTemplate,
  Upload,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
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
  disabled?: boolean;
}

interface FABOption {
  mode: CreationMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FAB_SIZE = 60;
const OPTION_SIZE = 50;

// ============================================================================
// COMPONENT
// ============================================================================

export const SurveyCreationFAB: React.FC<SurveyCreationFABProps> = ({
  onSelect,
  disabled,
}) => {
  const { colors, isDark } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const fabRotation = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const optionAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Check reduced motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => listener.remove();
  }, []);

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
      label: 'Import',
      icon: <Upload size={22} />,
      color: colors.warning,
      description: 'CSV, Excel, JSON',
    },
    {
      mode: 'conversational',
      label: 'AI Builder',
      icon: <MessageSquarePlus size={22} />,
      color: colors.info,
      description: 'Conversational mode',
    },
  ];

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    const duration = reduceMotion ? 0 : 200;

    // FAB rotation
    Animated.timing(fabRotation, {
      toValue: newExpanded ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();

    // Backdrop fade
    Animated.timing(backdropOpacity, {
      toValue: newExpanded ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();

    // Options staggered animation
    if (newExpanded) {
      optionAnimations.forEach((anim, index) => {
        Animated.spring(anim, {
          toValue: 1,
          delay: reduceMotion ? 0 : index * 50,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }).start();
      });
    } else {
      optionAnimations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0,
          duration: reduceMotion ? 0 : 150,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSelect = (mode: CreationMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Quick scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Collapse and callback
    setIsExpanded(false);
    Animated.parallel([
      Animated.timing(fabRotation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      ...optionAnimations.map((anim) =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        })
      ),
    ]).start(() => {
      onSelect(mode);
    });
  };

  const fabRotationInterpolate = fabRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
              backgroundColor: isDark
                ? 'rgba(0, 0, 0, 0.7)'
                : 'rgba(0, 0, 0, 0.5)',
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
      <View style={styles.optionsContainer} pointerEvents={isExpanded ? 'auto' : 'none'}>
        {options.map((option, index) => {
          const translateY = optionAnimations[index].interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          });
          const scale = optionAnimations[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          });
          const opacity = optionAnimations[index];

          return (
            <Animated.View
              key={option.mode}
              style={[
                styles.optionWrapper,
                {
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => handleSelect(option.mode)}
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
        })}
      </View>

      {/* Main FAB */}
      <Animated.View style={[styles.fabWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: isExpanded ? colors.error : colors.primary,
              opacity: disabled ? 0.5 : 1,
            },
            SHADOWS.lg,
          ]}
          onPress={toggleExpanded}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Close creation menu' : 'Create new survey'}
          accessibilityState={{ expanded: isExpanded }}
        >
          <Animated.View style={{ transform: [{ rotate: fabRotationInterpolate }] }}>
            <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
          </Animated.View>
        </TouchableOpacity>

        {/* Pulse animation ring when not expanded */}
        {!isExpanded && !disabled && (
          <View
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
}

export const CompactFAB: React.FC<CompactFABProps> = ({
  onPress,
  disabled,
  hasOptions,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress();
  };

  return (
    <Animated.View style={[styles.fabWrapper, { transform: [{ scale: scaleAnim }] }]}>
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
          <Sparkles size={26} color="#FFFFFF" />
        ) : (
          <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
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
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

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
      description: 'Import from CSV, Excel, or JSON files',
    },
    {
      mode: 'conversational',
      label: 'AI-Powered Builder',
      icon: <MessageSquarePlus size={24} />,
      color: colors.info,
      description: 'Build your survey in a conversational flow',
    },
  ];

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

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
          {
            backgroundColor: colors.card,
            transform: [{ translateY }],
          },
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
    bottom: SPACING.xl + 80, // Above bottom tabs
    right: SPACING.lg,
    zIndex: 1000,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: FAB_SIZE + 16,
    height: FAB_SIZE + 16,
    borderRadius: (FAB_SIZE + 16) / 2,
    borderWidth: 2,
    top: -8,
    left: -8,
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },

  // Options
  optionsContainer: {
    position: 'absolute',
    bottom: SPACING.xl + 80 + FAB_SIZE + SPACING.md,
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
    paddingVertical: SPACING.sm,
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
  },
  selectorOptionDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  selectorCancel: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  selectorCancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
});

export default SurveyCreationFAB;
