/**
 * SearchOverlay Component
 * 
 * Full-screen search overlay with:
 * - Recent searches with quick access
 * - Suggestions based on query
 * - Animated transitions
 * - Empty state handling
 * - Keyboard-aware design
 * 
 * Industry Standards:
 * - iOS/Android native search patterns
 * - Accessibility compliant (WCAG 2.1)
 * - Performance optimized (memoization)
 */

import React, { useCallback, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Clock, TrendingUp, ArrowUpLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';

export interface SearchOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Current search query */
  query: string;
  /** Query change handler */
  onChangeQuery: (query: string) => void;
  /** Submit handler */
  onSubmit: (query: string) => void;
  /** Recent searches array */
  recentSearches: string[];
  /** Remove from history handler */
  onRemoveFromHistory: (term: string) => void;
  /** Clear all history handler */
  onClearHistory: () => void;
  /** Suggestions array */
  suggestions?: string[];
  /** Placeholder text */
  placeholder?: string;
  /** Section title for search context */
  searchContext?: string;
  /** Trending searches (optional) */
  trendingSearches?: string[];
}

interface SearchItemProps {
  item: string;
  onPress: (item: string) => void;
  onRemove?: (item: string) => void;
  icon: React.ReactNode;
  showRemove?: boolean;
}

const SearchItem = memo(({ item, onPress, onRemove, icon, showRemove }: SearchItemProps) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.searchItem, { borderBottomColor: colors.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
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
        {showRemove && onRemove ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onRemove(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Remove ${item} from history`}
          >
            <X size={18} color={colors.textMuted} strokeWidth={1.5} />
          </TouchableOpacity>
        ) : (
          <ArrowUpLeft size={18} color={colors.textMuted} strokeWidth={1.5} />
        )}
      </View>
    </TouchableOpacity>
  );
});

SearchItem.displayName = 'SearchItem';

export function SearchOverlay({
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
  searchContext,
  trendingSearches = [],
}: SearchOverlayProps): React.ReactElement | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Focus input after animation
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

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

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeQuery('');
    inputRef.current?.focus();
  }, [onChangeQuery]);

  // Show suggestions if query exists, otherwise show recent
  const showSuggestions = query.length > 0 && suggestions.length > 0;
  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showTrending = query.length === 0 && trendingSearches.length > 0 && recentSearches.length === 0;

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
            {
              backgroundColor: colors.background,
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Header with Search Input */}
          <Animated.View
            style={[
              styles.header,
              {
                paddingTop: insets.top + SPACING.sm,
                borderBottomColor: colors.border,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={[styles.searchInputContainer, { backgroundColor: colors.card }]}>
              <Search size={20} color={colors.textMuted} strokeWidth={1.5} />
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={onChangeQuery}
                onSubmitEditing={handleSubmit}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                accessibilityLabel={placeholder}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={handleClear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={18} color={colors.textMuted} strokeWidth={1.5} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelButton}
              accessibilityLabel="Cancel search"
            >
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Search Context Badge */}
          {searchContext && (
            <View style={styles.contextContainer}>
              <View style={[styles.contextBadge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <Text style={[styles.contextText, { color: colors.primary }]}>
                  Searching in: {searchContext}
                </Text>
              </View>
            </View>
          )}

          {/* Suggestions */}
          {showSuggestions && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Suggestions</Text>
              {suggestions.map((item, index) => (
                <SearchItem
                  key={`suggestion-${index}`}
                  item={item}
                  onPress={handleSelectItem}
                  icon={<Search size={18} color={colors.textMuted} strokeWidth={1.5} />}
                />
              ))}
            </View>
          )}

          {/* Recent Searches */}
          {showRecent && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Searches</Text>
                <TouchableOpacity onPress={onClearHistory} accessibilityLabel="Clear all recent searches">
                  <Text style={[styles.clearAllText, { color: colors.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((item, index) => (
                <SearchItem
                  key={`recent-${index}`}
                  item={item}
                  onPress={handleSelectItem}
                  onRemove={onRemoveFromHistory}
                  icon={<Clock size={18} color={colors.textMuted} strokeWidth={1.5} />}
                  showRemove
                />
              ))}
            </View>
          )}

          {/* Trending Searches */}
          {showTrending && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Trending Searches</Text>
              {trendingSearches.map((item, index) => (
                <SearchItem
                  key={`trending-${index}`}
                  item={item}
                  onPress={handleSelectItem}
                  icon={<TrendingUp size={18} color={colors.warning} strokeWidth={1.5} />}
                />
              ))}
            </View>
          )}

          {/* Empty State */}
          {!showSuggestions && !showRecent && !showTrending && query.length === 0 && (
            <View style={styles.emptyState}>
              <Search size={48} color={colors.textMuted} strokeWidth={1} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Start Searching</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Type to search {searchContext?.toLowerCase() || 'content'}
              </Text>
            </View>
          )}

          {/* No Results */}
          {query.length > 0 && suggestions.length === 0 && (
            <View style={styles.emptyState}>
              <Search size={48} color={colors.textMuted} strokeWidth={1} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No suggestions found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Press search to find results for &ldquo;{query}&rdquo;
              </Text>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: SPACING.xs,
  },
  cancelButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  contextContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  contextBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  contextText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  section: {
    paddingTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  clearAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  searchItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  searchItemRight: {
    marginLeft: SPACING.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING['3xl'],
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export default SearchOverlay;
