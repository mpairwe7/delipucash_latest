/**
 * ScreenWrapper Component
 * 
 * Industry-standard screen wrapper following 2025-2026 mobile UX patterns from:
 * - Instagram, TikTok, Twitter/X (edge-to-edge, translucent bars)
 * - Notion, Reddit, Duolingo (consistent safe area handling)
 * 
 * Features:
 * - Automatic SafeAreaView with configurable edges
 * - Dynamic StatusBar styling based on theme
 * - Edge-to-edge support for Android 10+
 * - Optional custom header with back button
 * - Consistent bottom inset handling for gesture navigation
 * - WCAG 2.2 AA accessibility compliance
 * 
 * @module components/ui/ScreenWrapper
 */

import React, { memo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Platform,
  ViewStyle,
} from 'react-native';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets, Edge } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, X } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_SIZE,
  RADIUS,
} from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

export type ScreenVariant = 'default' | 'modal' | 'fullscreen';

export interface ScreenWrapperProps {
  /** Screen content */
  children: React.ReactNode;
  
  /** Screen variant determining SafeArea behavior */
  variant?: ScreenVariant;
  
  /** SafeArea edges to respect (default: ['top', 'bottom'] for default variant) */
  edges?: Edge[];
  
  /** Show built-in header with back/close button */
  showHeader?: boolean;
  
  /** Header title */
  headerTitle?: string;
  
  /** Custom right header component */
  headerRight?: React.ReactNode;
  
  /** Override back button behavior */
  onBack?: () => void;
  
  /** Hide back button even when showHeader is true */
  hideBackButton?: boolean;
  
  /** Override status bar style */
  statusBarStyle?: StatusBarStyle;
  
  /** Make status bar translucent (Android) */
  statusBarTranslucent?: boolean;
  
  /** Container style override */
  style?: ViewStyle;
  
  /** Background color override */
  backgroundColor?: string;
  
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// BACK BUTTON COMPONENT
// ============================================================================

interface BackButtonProps {
  onPress: () => void;
  variant: ScreenVariant;
  colors: ReturnType<typeof useTheme>['colors'];
}

const BackButton = memo(function BackButton({ 
  onPress, 
  variant, 
  colors 
}: BackButtonProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const isModal = variant === 'modal';
  const Icon = isModal ? X : ArrowLeft;
  const accessibilityLabel = isModal ? 'Close' : 'Go back';
  const accessibilityHint = isModal 
    ? 'Closes this screen' 
    : 'Returns to the previous screen';

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.backButton,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );
});

// ============================================================================
// HEADER COMPONENT
// ============================================================================

interface HeaderProps {
  title?: string;
  variant: ScreenVariant;
  onBack: () => void;
  hideBackButton?: boolean;
  rightComponent?: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}

const Header = memo(function Header({
  title,
  variant,
  onBack,
  hideBackButton,
  rightComponent,
  colors,
}: HeaderProps) {
  return (
    <View 
      style={[styles.header, { borderBottomColor: colors.border }]}
      accessibilityRole="header"
    >
      {/* Left: Back/Close button */}
      <View style={styles.headerLeft}>
        {!hideBackButton && (
          <BackButton 
            onPress={onBack} 
            variant={variant} 
            colors={colors} 
          />
        )}
      </View>

      {/* Center: Title */}
      <View style={styles.headerCenter}>
        {title && (
          <Text 
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        )}
      </View>

      {/* Right: Custom component or spacer */}
      <View style={styles.headerRight}>
        {rightComponent}
      </View>
    </View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ScreenWrapperComponent({
  children,
  variant = 'default',
  edges,
  showHeader = false,
  headerTitle,
  headerRight,
  onBack,
  hideBackButton = false,
  statusBarStyle,
  statusBarTranslucent = true,
  style,
  backgroundColor,
  testID,
}: ScreenWrapperProps): React.ReactElement {
  const router = useRouter();
  const { colors, statusBarStyle: themeStatusBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  // Determine edges based on variant
  const safeAreaEdges: Edge[] = edges ?? getDefaultEdges(variant);

  // Determine status bar style
  const resolvedStatusBarStyle = statusBarStyle ?? themeStatusBarStyle;

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  // Background color
  const bgColor = backgroundColor ?? colors.background;

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { backgroundColor: bgColor },
        style,
      ]}
      edges={safeAreaEdges}
      testID={testID}
    >
      {/* Status bar with animated transitions for theme changes */}
      <StatusBar 
        style={resolvedStatusBarStyle} 
        translucent={statusBarTranslucent}
        animated
      />

      {/* Optional header */}
      {showHeader && (
        <Header
          title={headerTitle}
          variant={variant}
          onBack={handleBack}
          hideBackButton={hideBackButton}
          rightComponent={headerRight}
          colors={colors}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Bottom padding for gesture navigation on Android */}
      {Platform.OS === 'android' && !safeAreaEdges.includes('bottom') && (
        <View style={{ height: insets.bottom }} />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultEdges(variant: ScreenVariant): Edge[] {
  switch (variant) {
    case 'modal':
      // Modals typically handle their own bottom inset for action buttons
      return ['top'];
    case 'fullscreen':
      // Fullscreen (video players, image viewers) - no safe area
      return [];
    case 'default':
    default:
      // Regular screens - top and bottom safe area
      return ['top', 'bottom'];
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: COMPONENT_SIZE.header.standard,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    width: COMPONENT_SIZE.touchTarget,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  headerRight: {
    width: COMPONENT_SIZE.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  backButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const ScreenWrapper = memo(ScreenWrapperComponent);

/**
 * Hook to get safe area insets with optional edge filtering
 * Use this in screens that need manual inset handling
 */
export function useScreenInsets(edges: Edge[] = ['top', 'bottom', 'left', 'right']) {
  const insets = useSafeAreaInsets();
  
  return {
    top: edges.includes('top') ? insets.top : 0,
    bottom: edges.includes('bottom') ? insets.bottom : 0,
    left: edges.includes('left') ? insets.left : 0,
    right: edges.includes('right') ? insets.right : 0,
  };
}
