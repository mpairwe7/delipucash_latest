/**
 * SearchOverlay — YouTube-style full-screen search experience
 *
 * - Slides in from right (Reanimated native thread)
 * - Header: [Back arrow] [Pill TextInput] [Mic button]
 * - Arrow-up-left on each item fills input without submitting
 * - Recent searches, suggestions, trending sections
 * - ScrollView with keyboard handling
 */

import React, { useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Keyboard,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X, Clock, TrendingUp, ArrowUpLeft, Search, Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

export interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  query: string;
  onChangeQuery: (query: string) => void;
  onSubmit: (query: string) => void;
  recentSearches: string[];
  onRemoveFromHistory: (term: string) => void;
  onClearHistory: () => void;
  suggestions?: string[];
  placeholder?: string;
  searchContext?: string;
  trendingSearches?: string[];
}

// ============================================================================
// SEARCH ITEM
// ============================================================================

interface SearchItemProps {
  item: string;
  onPress: (item: string) => void;
  onRemove?: (item: string) => void;
  onFill?: (item: string) => void;
  icon: React.ReactNode;
  showRemove?: boolean;
}

const SearchItem = memo(({ item, onPress, onRemove, onFill, icon, showRemove }: SearchItemProps) => {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.searchItem,
        pressed && { backgroundColor: withAlpha(colors.text, 0.05) },
      ]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Search for ${item}`}
    >
      <View style={styles.searchItemLeft}>
        {icon}
        <Text style={[styles.searchItemText, { color: colors.text }]} numberOfLines={1}>
          {item}
        </Text>
      </View>

      <View style={styles.searchItemRight}>
        {showRemove && onRemove && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRemove(item);
            }}
            hitSlop={10}
            style={styles.itemAction}
            accessibilityLabel={`Remove ${item} from history`}
          >
            <X size={16} color={colors.textMuted} strokeWidth={1.5} />
          </Pressable>
        )}
        {onFill && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onFill(item);
            }}
            hitSlop={10}
            style={styles.itemAction}
            accessibilityLabel={`Fill search with ${item}`}
          >
            <ArrowUpLeft size={18} color={colors.textMuted} strokeWidth={1.5} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

SearchItem.displayName = 'SearchItem';

// ============================================================================
// SEARCH OVERLAY
// ============================================================================

function SearchOverlayComponent({
  visible,
  onClose,
  query,
  onChangeQuery,
  onSubmit,
  recentSearches,
  onRemoveFromHistory,
  onClearHistory,
  suggestions = [],
  placeholder = 'Search...',
  trendingSearches = [],
}: SearchOverlayProps): React.ReactElement | null {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // Reanimated shared values for slide-from-right
  const translateX = useSharedValue(SCREEN_WIDTH);
  const opacity = useSharedValue(0);

  // Animate open / close
  useEffect(() => {
    if (visible) {
      translateX.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, { duration: 200 });
      // Focus input after animation settles
      setTimeout(() => inputRef.current?.focus(), 280);
    } else {
      translateX.value = withTiming(SCREEN_WIDTH, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, translateX, opacity]);

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // ──────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    if (query.trim().length > 0) {
      Keyboard.dismiss();
      onSubmit(query.trim());
      onClose();
    }
  }, [query, onSubmit, onClose]);

  const handleSelectItem = useCallback((item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeQuery(item);
    onSubmit(item);
    onClose();
  }, [onChangeQuery, onSubmit, onClose]);

  /** YouTube behavior: fills input with term but does NOT submit */
  const handleFillInput = useCallback((item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeQuery(item);
    inputRef.current?.focus();
  }, [onChangeQuery]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeQuery('');
    inputRef.current?.focus();
  }, [onChangeQuery]);

  // ──────────────────────────────────────────────────────────────
  // DERIVED STATE
  // ──────────────────────────────────────────────────────────────

  const showSuggestions = query.length > 0 && suggestions.length > 0;
  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showTrending = query.length === 0 && trendingSearches.length > 0 && recentSearches.length === 0;

  const pillBg = isDark ? '#272727' : '#F2F2F2';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: colors.background },
            overlayStyle,
          ]}
        >
          {/* ── Header: [Back] [Pill Input] [Mic] ── */}
          <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
            {/* Back arrow */}
            <Pressable
              onPress={handleClose}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
            </Pressable>

            {/* Search input pill */}
            <View style={[styles.searchPill, { backgroundColor: pillBg }]}>
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={placeholder}
                placeholderTextColor={withAlpha(colors.text, 0.5)}
                value={query}
                onChangeText={onChangeQuery}
                onSubmitEditing={handleSubmit}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={colors.primary}
                accessibilityLabel={placeholder}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={handleClear}
                  hitSlop={8}
                  accessibilityLabel="Clear search"
                >
                  <X size={18} color={withAlpha(colors.text, 0.6)} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Mic button (YouTube circular, visible when no query) */}
            {query.length === 0 && (
              <View style={[styles.micButton, { backgroundColor: pillBg }]}>
                <Mic size={20} color={colors.text} strokeWidth={2} />
              </View>
            )}
          </View>

          {/* ── Content ── */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Suggestions */}
            {showSuggestions && (
              <View style={styles.section}>
                {suggestions.map((item, index) => (
                  <SearchItem
                    key={`suggestion-${index}`}
                    item={item}
                    onPress={handleSelectItem}
                    onFill={handleFillInput}
                    icon={<Search size={18} color={colors.textMuted} strokeWidth={1.5} />}
                  />
                ))}
              </View>
            )}

            {/* Recent Searches */}
            {showRecent && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    Recent searches
                  </Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClearHistory();
                    }}
                    accessibilityLabel="Clear all recent searches"
                  >
                    <Text style={[styles.clearAllText, { color: colors.primary }]}>
                      Clear all
                    </Text>
                  </Pressable>
                </View>
                {recentSearches.map((item, index) => (
                  <SearchItem
                    key={`recent-${index}`}
                    item={item}
                    onPress={handleSelectItem}
                    onRemove={onRemoveFromHistory}
                    onFill={handleFillInput}
                    icon={<Clock size={18} color={colors.textMuted} strokeWidth={1.5} />}
                    showRemove
                  />
                ))}
              </View>
            )}

            {/* Trending Searches */}
            {showTrending && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }, styles.sectionTitlePadded]}>
                  Trending searches
                </Text>
                {trendingSearches.map((item, index) => (
                  <SearchItem
                    key={`trending-${index}`}
                    item={item}
                    onPress={handleSelectItem}
                    onFill={handleFillInput}
                    icon={<TrendingUp size={18} color={colors.warning} strokeWidth={1.5} />}
                  />
                ))}
              </View>
            )}

            {/* Empty State */}
            {!showSuggestions && !showRecent && !showTrending && query.length === 0 && (
              <View style={styles.emptyState}>
                <Search size={36} color={withAlpha(colors.text, 0.2)} strokeWidth={1} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Search videos
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Find videos, creators, and more
                </Text>
              </View>
            )}

            {/* No Results for typed query */}
            {query.length > 0 && suggestions.length === 0 && (
              <View style={styles.emptyState}>
                <Search size={36} color={withAlpha(colors.text, 0.2)} strokeWidth={1} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No suggestions found
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Press search to find results for {'\u201C'}{query}{'\u201D'}
                </Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.base,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: 0,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content
  scrollContent: {
    flexGrow: 1,
  },

  // Sections
  section: {
    paddingTop: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  sectionTitlePadded: {
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.xs,
  },
  clearAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  // Search Items
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  searchItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  searchItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  searchItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  itemAction: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty States
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING['3xl'],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export const SearchOverlay = memo(SearchOverlayComponent);
SearchOverlay.displayName = 'SearchOverlay';

export default SearchOverlay;
