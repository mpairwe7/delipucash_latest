/**
 * CollapsibleSearchBar — YouTube-style pill search bar
 *
 * - Collapses to icon-only on scroll-down, expands on scroll-up
 * - Clean solid-fill pill (no border, no glassmorphism)
 * - Tap opens SearchOverlay for full search experience
 * - Native-thread animations via Reanimated for 60 fps
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  Extrapolate,
  interpolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Search, X } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

export interface CollapsibleSearchBarProps {
  /** Current search query */
  query: string;
  /** Query change handler */
  onChangeQuery: (query: string) => void;
  /** Submit/focus handler — opens search overlay */
  onFocus: () => void;
  /** Clear search handler */
  onClear: () => void;
  /** Scroll offset for collapse detection (0-1, where 1 = fully collapsed) */
  scrollProgress: SharedValue<number>;
  /** Placeholder text */
  placeholder?: string;
}

export const CollapsibleSearchBar = React.memo(
  ({
    query,
    onChangeQuery,
    onFocus,
    onClear,
    scrollProgress,
    placeholder = 'Search videos, creators...',
  }: CollapsibleSearchBarProps) => {
    const { colors, isDark } = useTheme();

    // ──────────────────────────────────────────────────────────────
    // COLLAPSE STATE (bridged from UI thread via useDerivedValue)
    // Fixes Reanimated warning: no .value reads in JSX render
    // ──────────────────────────────────────────────────────────────

    const [isCollapsed, setIsCollapsed] = useState(false);

    useDerivedValue(() => {
      const collapsed = scrollProgress.value > 0.5;
      runOnJS(setIsCollapsed)(collapsed);
      return collapsed;
    });

    // ──────────────────────────────────────────────────────────────
    // ANIMATED STYLES
    // ──────────────────────────────────────────────────────────────

    // Input wrapper: fades out and shrinks as user scrolls
    const inputAnimStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        scrollProgress.value,
        [0, 0.7],
        [1, 0],
        Extrapolate.CLAMP
      ),
      flex: interpolate(
        scrollProgress.value,
        [0, 1],
        [1, 0],
        Extrapolate.CLAMP
      ),
    }));

    // Container padding: tightens when collapsed
    const paddingAnimStyle = useAnimatedStyle(() => ({
      paddingHorizontal: interpolate(
        scrollProgress.value,
        [0, 1],
        [SPACING.md, SPACING.sm],
        Extrapolate.CLAMP
      ),
    }));

    // Clear button: visible when query exists AND bar is expanded
    const clearAnimStyle = useAnimatedStyle(() => ({
      opacity: interpolate(
        scrollProgress.value,
        [0, 0.7],
        [query.length > 0 ? 1 : 0, 0],
        Extrapolate.CLAMP
      ),
    }));

    // ──────────────────────────────────────────────────────────────
    // HANDLERS
    // ──────────────────────────────────────────────────────────────

    const handleClear = useCallback(() => {
      onChangeQuery('');
      onClear();
    }, [onChangeQuery, onClear]);

    const handlePress = useCallback(() => {
      onFocus();
    }, [onFocus]);

    const accessibilityLabel = useMemo(() => {
      return query
        ? `Search field with query: ${query}`
        : 'Search videos';
    }, [query]);

    // YouTube-style background: solid fill, no transparency
    const pillBg = isDark ? '#272727' : '#F2F2F2';

    return (
      <Animated.View
        style={[
          styles.pill,
          paddingAnimStyle,
          { backgroundColor: pillBg },
        ]}
        accessible
        accessibilityRole="search"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Tap to search videos"
      >
        {/* Search icon — always visible */}
        <Pressable
          onPress={handlePress}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={6}
        >
          <Search
            size={18}
            color={withAlpha(colors.text, 0.6)}
            strokeWidth={2}
          />
        </Pressable>

        {/* Input area — fades on scroll */}
        <Animated.View
          style={[styles.inputWrapper, inputAnimStyle]}
          pointerEvents={isCollapsed ? 'none' : 'auto'}
        >
          <Pressable
            style={styles.inputPressable}
            onPress={handlePress}
            accessibilityRole="search"
            accessibilityLabel="Search input"
            accessibilityHint="Open search"
          >
            <Text
              style={[
                styles.inputText,
                { color: query ? colors.text : withAlpha(colors.text, 0.5) },
              ]}
              numberOfLines={1}
            >
              {query || placeholder}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Clear button — visible when query exists and expanded */}
        {query.length > 0 && (
          <Animated.View style={[styles.clearButton, clearAnimStyle]}>
            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <X
                size={16}
                color={withAlpha(colors.text, 0.6)}
                strokeWidth={2}
              />
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    );
  }
);

CollapsibleSearchBar.displayName = 'CollapsibleSearchBar';

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },

  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },

  inputWrapper: {
    justifyContent: 'center',
    overflow: 'hidden',
  },

  inputPressable: {
    flex: 1,
    justifyContent: 'center',
  },

  inputText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
});
