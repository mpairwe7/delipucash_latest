/**
 * SearchBar Component
 * Reusable search input with animations and design system compliance
 */

import React, { useCallback, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  Pressable,
  TextInputProps,
} from 'react-native';
import Animated, { 
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme } from '@/utils/theme';

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onClear,
  placeholder = 'Search...',
  autoFocus = false,
  ...textInputProps
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  
  const borderColorValue = useSharedValue(0);
  const clearButtonOpacity = useSharedValue(value.length > 0 ? 1 : 0);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: borderColorValue.value === 1 
      ? colors.primary 
      : colors.border,
  }));

  const clearButtonStyle = useAnimatedStyle(() => ({
    opacity: clearButtonOpacity.value,
    transform: [{ scale: clearButtonOpacity.value }],
  }));

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    borderColorValue.value = withTiming(1, { duration: ANIMATION.duration.fast });
  }, [borderColorValue]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    borderColorValue.value = withTiming(0, { duration: ANIMATION.duration.fast });
  }, [borderColorValue]);

  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
    clearButtonOpacity.value = withSpring(text.length > 0 ? 1 : 0, {
      stiffness: 400,
      damping: 20,
    });
  }, [onChangeText, clearButtonOpacity]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeText('');
    clearButtonOpacity.value = withSpring(0, { stiffness: 400, damping: 20 });
    onClear?.();
  }, [onChangeText, clearButtonOpacity, onClear]);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderWidth: 1.5,
    },
    searchIcon: {
      marginRight: SPACING.sm,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      paddingVertical: SPACING.xxs,
      fontFamily: 'Roboto_400Regular',
    },
    clearButton: {
      marginLeft: SPACING.sm,
      width: 24,
      height: 24,
      borderRadius: RADIUS.full,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <Animated.View 
      entering={FadeIn.duration(ANIMATION.duration.normal)}
      style={[styles.container, containerStyle]}
    >
      <View style={styles.searchIcon}>
        <Search 
          size={ICON_SIZE.sm} 
          color={isFocused ? colors.primary : colors.textMuted} 
        />
      </View>
      
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        {...textInputProps}
      />
      
      {value.length > 0 && (
        <Animated.View style={clearButtonStyle}>
          <Pressable
            style={styles.clearButton}
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={14} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default SearchBar;
