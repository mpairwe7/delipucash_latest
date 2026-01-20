import React, { useRef, useEffect, forwardRef, memo } from 'react';
import {
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  type ViewStyle,
  type LayoutChangeEvent,
  type KeyboardEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Keyboard avoiding behavior types
 */
export type KeyboardBehavior = 'height' | 'padding' | 'position';

/**
 * Layout reference for the animated view
 */
interface LayoutRef {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Props for the KeyboardAvoidingAnimatedView component
 */
export interface KeyboardAvoidingAnimatedViewProps {
  /** Child components */
  children: React.ReactNode;
  /** Keyboard avoiding behavior */
  behavior?: KeyboardBehavior;
  /** Vertical offset for keyboard */
  keyboardVerticalOffset?: number;
  /** Container style */
  style?: ViewStyle;
  /** Content container style (used with 'position' behavior) */
  contentContainerStyle?: ViewStyle;
  /** Whether keyboard avoiding is enabled */
  enabled?: boolean;
  /** Layout change callback */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Test ID for testing */
  testID?: string;
}

const DEFAULT_ANIMATION_DURATION = 300;

/**
 * Animated keyboard avoiding view with smooth transitions.
 * Uses react-native-reanimated for performant animations.
 * Falls back to standard KeyboardAvoidingView on web.
 *
 * @example
 * ```tsx
 * <KeyboardAvoidingAnimatedView
 *   behavior="padding"
 *   keyboardVerticalOffset={100}
 *   style={{ flex: 1 }}
 * >
 *   <YourContent />
 * </KeyboardAvoidingAnimatedView>
 * ```
 */
const KeyboardAvoidingAnimatedViewComponent = forwardRef<
  Animated.View,
  KeyboardAvoidingAnimatedViewProps
>((props, ref) => {
  const {
    children,
    behavior = Platform.OS === 'ios' ? 'padding' : 'height',
    keyboardVerticalOffset = 0,
    style,
    contentContainerStyle,
    enabled = true,
    onLayout,
    testID,
    ...restProps
  } = props;

  const animatedViewRef = useRef<LayoutRef | null>(null);
  const initialHeightRef = useRef<number>(0);
  const bottomHeight = useSharedValue(0);

  useEffect(() => {
    if (!enabled) return;

    const onKeyboardShow = (event: KeyboardEvent) => {
      const { duration, endCoordinates } = event;
      const animatedView = animatedViewRef.current;

      if (!animatedView) return;

      const keyboardY = endCoordinates.screenY - keyboardVerticalOffset;
      const height = Math.max(animatedView.y + animatedView.height - keyboardY, 0);

      bottomHeight.value = withTiming(height, {
        duration: duration > 10 ? duration : DEFAULT_ANIMATION_DURATION,
      });
    };

    const onKeyboardHide = () => {
      bottomHeight.value = withTiming(0, { duration: DEFAULT_ANIMATION_DURATION });
    };

    const showListener = Keyboard.addListener('keyboardWillShow', onKeyboardShow);
    const hideListener = Keyboard.addListener('keyboardWillHide', onKeyboardHide);

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [keyboardVerticalOffset, enabled, bottomHeight]);

  const animatedStyle = useAnimatedStyle(() => {
    if (behavior === 'height') {
      return {
        height: initialHeightRef.current - bottomHeight.value,
        flex: bottomHeight.value > 0 ? 0 : undefined,
      };
    }
    if (behavior === 'padding') {
      return {
        paddingBottom: bottomHeight.value,
      };
    }
    return {};
  });

  const positionAnimatedStyle = useAnimatedStyle(() => ({
    bottom: bottomHeight.value,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    const { layout } = event.nativeEvent;
    animatedViewRef.current = layout;

    if (!initialHeightRef.current) {
      initialHeightRef.current = layout.height;
    }

    onLayout?.(event);
  };

  const renderContent = () => {
    if (behavior === 'position') {
      return (
        <Animated.View style={[contentContainerStyle, positionAnimatedStyle]}>
          {children}
        </Animated.View>
      );
    }
    return children;
  };

  // For web, use standard KeyboardAvoidingView
  if (Platform.OS === 'web') {
    return (
      <KeyboardAvoidingView
        behavior={behavior}
        style={style}
        contentContainerStyle={contentContainerStyle}
        testID={testID}
        {...restProps}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <Animated.View
      ref={ref}
      style={[style, animatedStyle]}
      onLayout={handleLayout}
      testID={testID}
      {...restProps}
    >
      {renderContent()}
    </Animated.View>
  );
});

KeyboardAvoidingAnimatedViewComponent.displayName = 'KeyboardAvoidingAnimatedView';

export const KeyboardAvoidingAnimatedView = memo(KeyboardAvoidingAnimatedViewComponent);

export default KeyboardAvoidingAnimatedView;
