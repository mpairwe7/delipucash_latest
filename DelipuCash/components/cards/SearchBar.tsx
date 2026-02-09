/**
 * SearchBar Component
 * Reusable search input with optional filters
 * 
 * @example
 * ```tsx
 * <SearchBar
 *   placeholder="Search videos, surveys..."
 *   value={query}
 *   onChangeText={setQuery}
 *   onSubmit={handleSearch}
 * />
 * ```
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Keyboard,
} from 'react-native';
import { Search, X, Sliders } from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  COMPONENT_SIZE,
} from '@/utils/theme';

export interface SearchBarProps {
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Value change handler */
  onChangeText?: (text: string) => void;
  /** Submit/search handler */
  onSubmit?: (text: string) => void;
  /** Optional leading icon override */
  icon?: React.ReactNode;
  /** Filter button handler - shows filter button when provided */
  onFilter?: () => void;
  /** Focus handler */
  onFocus?: () => void;
  /** Blur handler */
  onBlur?: () => void;
  /** Auto focus */
  autoFocus?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

function SearchBarComponent({
  placeholder = 'Search...',
  value = '',
  onChangeText,
  onSubmit,
  icon,
  onFilter,
  onFocus,
  onBlur,
  autoFocus = false,
  style,
  testID,
}: SearchBarProps): React.ReactElement {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleClear = useCallback(() => {
    onChangeText?.('');
  }, [onChangeText]);

  const handleSubmit = useCallback(() => {
    Keyboard.dismiss();
    onSubmit?.(value);
  }, [onSubmit, value]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isFocused ? colors.primary : colors.border,
        },
        style,
      ]}
      testID={testID}
    >
      {icon ? (
        icon
      ) : (
        <Search
          size={20}
          color={isFocused ? colors.primary : colors.textMuted}
          strokeWidth={1.5}
        />
      )}
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSubmit}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          activeOpacity={0.7}
          accessibilityLabel="Clear search"
        >
          <X size={18} color={colors.textMuted} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
      {onFilter && (
        <TouchableOpacity
          onPress={onFilter}
          style={[styles.filterButton, { backgroundColor: colors.elevated }]}
          activeOpacity={0.7}
          accessibilityLabel="Open filters"
        >
          <Sliders size={18} color={colors.text} strokeWidth={1.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: COMPONENT_SIZE.input.medium,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    height: '100%',
    paddingVertical: 0,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  filterButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginLeft: SPACING.xs,
  },
});

export const SearchBar = memo(SearchBarComponent);
SearchBar.displayName = 'SearchBar';

export default SearchBar;
