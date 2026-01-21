/**
 * NotificationFilters Component
 * Horizontal scrollable filter chips for notifications
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import Animated, { 
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
import type { NotificationCategory } from '@/services/notificationApi';

export type FilterOption = 'all' | 'unread' | NotificationCategory;

interface FilterChipData {
  id: FilterOption;
  label: string;
  count?: number;
}

interface NotificationFiltersProps {
  selectedFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  unreadCount?: number;
  categoryCounts?: Partial<Record<NotificationCategory, number>>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DEFAULT_FILTERS: FilterChipData[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'payments', label: 'Payments' },
  { id: 'rewards', label: 'Rewards' },
  { id: 'surveys', label: 'Surveys' },
  { id: 'security', label: 'Security' },
  { id: 'achievements', label: 'Achievements' },
];

interface FilterChipProps {
  filter: FilterChipData;
  isSelected: boolean;
  onPress: (filter: FilterOption) => void;
  colors: any;
}

const FilterChip: React.FC<FilterChipProps> = ({
  filter,
  isSelected,
  onPress,
  colors,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(filter.id);
  }, [filter.id, onPress]);

  const styles = StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.full,
      backgroundColor: isSelected ? colors.primary : colors.card,
      borderWidth: 1,
      borderColor: isSelected ? colors.primary : colors.border,
      marginRight: SPACING.xs,
    },
    label: {
      fontSize: 13,
      fontWeight: isSelected ? '600' : '500',
      color: isSelected ? '#FFFFFF' : colors.textSecondary,
    },
    countBadge: {
      backgroundColor: isSelected 
        ? withAlpha('#FFFFFF', 0.2) 
        : withAlpha(colors.primary, 0.1),
      paddingHorizontal: SPACING.xs,
      paddingVertical: 1,
      borderRadius: RADIUS.full,
      marginLeft: SPACING.xs,
      minWidth: 18,
      alignItems: 'center',
    },
    countText: {
      fontSize: 10,
      fontWeight: '600',
      color: isSelected ? '#FFFFFF' : colors.primary,
    },
  });

  return (
    <AnimatedPressable
      style={[styles.chip, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <ThemedText style={styles.label}>{filter.label}</ThemedText>
      {filter.count !== undefined && filter.count > 0 && (
        <View style={styles.countBadge}>
          <ThemedText style={styles.countText}>
            {filter.count > 99 ? '99+' : filter.count}
          </ThemedText>
        </View>
      )}
    </AnimatedPressable>
  );
};

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedFilter,
  onFilterChange,
  unreadCount = 0,
  categoryCounts = {},
}) => {
  const { colors } = useTheme();

  // Build filter data with counts
  const filters: FilterChipData[] = DEFAULT_FILTERS.map(filter => {
    if (filter.id === 'unread') {
      return { ...filter, count: unreadCount };
    }
    if (filter.id in categoryCounts) {
      return { ...filter, count: categoryCounts[filter.id as NotificationCategory] };
    }
    return filter;
  });

  const styles = StyleSheet.create({
    container: {
      marginBottom: SPACING.md,
    },
    scrollContent: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
  });

  return (
    <Animated.View 
      entering={FadeIn.duration(ANIMATION.duration.normal)}
      style={styles.container}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map(filter => (
          <FilterChip
            key={filter.id}
            filter={filter}
            isSelected={selectedFilter === filter.id}
            onPress={onFilterChange}
            colors={colors}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};

export default NotificationFilters;
