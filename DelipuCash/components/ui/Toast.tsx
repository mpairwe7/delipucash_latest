/**
 * Toast / Snackbar Component
 * Non-blocking feedback notifications following 2026 mobile UI/UX standards
 *
 * Features:
 * - Reanimated slide-in/out animation with spring physics
 * - Reduced motion support (instant show/hide)
 * - Haptic feedback on appearance
 * - Auto-dismiss with configurable duration
 * - WCAG 2.2 AA: accessibilityLiveRegion, accessibilityRole
 * - Swipe-to-dismiss via PanGesture
 * - Success / Error / Info / Warning variants
 */

import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react-native';
import {
  ICON_SIZE,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  Z_INDEX,
  useTheme,
} from '@/utils/theme';
import { triggerHaptic } from '@/utils/quiz-utils';
import { useReducedMotion } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  message: string;
  type?: ToastType;
  /** Duration in ms. Set 0 for persistent toast. Default: 3000 */
  duration?: number;
  /** Action button label */
  action?: string;
  /** Action button callback */
  onAction?: () => void;
}

interface ToastState extends ToastConfig {
  id: number;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

// ============================================================================
// ICON MAP
// ============================================================================

const TOAST_ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

// ============================================================================
// TOAST DISPLAY COMPONENT
// ============================================================================

const ToastDisplay = memo(function ToastDisplay({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  const type = toast.type || 'info';
  const Icon = TOAST_ICONS[type];

  const colorMap: Record<ToastType, string> = {
    success: colors.success,
    error: colors.error,
    info: colors.primary,
    warning: colors.warning,
  };

  const bgMap: Record<ToastType, string> = {
    success: `${colors.success}18`,
    error: `${colors.error}18`,
    info: `${colors.primary}18`,
    warning: `${colors.warning}18`,
  };

  const accentColor = colorMap[type];
  const bgColor = bgMap[type];

  // Swipe-up-to-dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY < -40) {
        runOnJS(onDismiss)();
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const entering = reduceMotion ? FadeIn.duration(100) : SlideInUp.springify().damping(15).stiffness(150);
  const exiting = reduceMotion ? FadeOut.duration(100) : SlideOutUp.springify().damping(15).stiffness(200);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        entering={entering}
        exiting={exiting}
        style={[
          styles.toastContainer,
          animatedStyle,
          {
            top: insets.top + SPACING.sm,
            backgroundColor: colors.card,
            borderLeftColor: accentColor,
            shadowColor: colors.text,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={`${type}: ${toast.message}`}
      >
        <View style={[styles.toastIconContainer, { backgroundColor: bgColor }]}>
          <Icon size={ICON_SIZE.lg} color={accentColor} strokeWidth={2} />
        </View>
        <Text
          style={[styles.toastMessage, { color: colors.text }]}
          numberOfLines={3}
        >
          {toast.message}
        </Text>
        {toast.action && toast.onAction && (
          <Text
            style={[styles.toastAction, { color: accentColor }]}
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            accessibilityRole="button"
          >
            {toast.action}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

// ============================================================================
// TOAST PROVIDER
// ============================================================================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hideToast = useCallback(() => {
    setToast(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (config: ToastConfig) => {
      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const id = ++idRef.current;
      const duration = config.duration ?? 3000;

      setToast({ ...config, id, visible: true });

      // Haptic feedback
      const hapticType =
        config.type === 'success'
          ? 'success'
          : config.type === 'error'
            ? 'error'
            : config.type === 'warning'
              ? 'warning'
              : 'light';
      triggerHaptic(hapticType);

      // Announce for screen readers
      AccessibilityInfo.announceForAccessibility(
        `${config.type || 'info'}: ${config.message}`
      );

      // Auto-dismiss
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          setToast((current) => (current?.id === id ? null : current));
        }, duration);
      }
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && <ToastDisplay toast={toast} onDismiss={hideToast} />}
    </ToastContext.Provider>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: SPACING.base,
    right: SPACING.base,
    zIndex: Z_INDEX.toast,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    borderRadius: RADIUS.base,
    borderLeftWidth: 4,
    gap: SPACING.md,
    // Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  toastIconContainer: {
    width: SPACING['2xl'] + SPACING.xs,
    height: SPACING['2xl'] + SPACING.xs,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastMessage: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
    lineHeight: TYPOGRAPHY.fontSize.md * TYPOGRAPHY.lineHeight.normal,
  },
  toastAction: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
});
