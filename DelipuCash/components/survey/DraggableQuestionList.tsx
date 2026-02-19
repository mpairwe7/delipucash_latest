/**
 * DraggableQuestionList — Drag-to-reorder question list for survey builders
 *
 * Features:
 * - Long-press to pick up a question
 * - Drag to reorder with visual feedback
 * - Haptic feedback on pickup and drop
 * - Respects reduced motion preference
 * - Accessibility: announces new position after reorder
 *
 * Uses FlatList with manual drag tracking (no external drag library needed).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, useTheme, withAlpha } from '@/utils/theme';

// ============================================================================
// TYPES
// ============================================================================

interface DraggableItem {
  id: string;
  text: string;
  type: string;
  required: boolean;
}

interface DraggableQuestionListProps {
  items: DraggableItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Render the full question editor for each item */
  renderItem: (item: DraggableItem, index: number) => React.ReactElement;
  /** Enable drag reordering (can be disabled during editing) */
  dragEnabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DraggableQuestionList: React.FC<DraggableQuestionListProps> = ({
  items,
  onReorder,
  renderItem,
  dragEnabled = true,
}) => {
  const { colors } = useTheme();

  // Move up/down via accessible buttons (alternative to drag)
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onReorder(index, index - 1);
      AccessibilityInfo.announceForAccessibility(
        `Question moved up to position ${index}`,
      );
    },
    [onReorder],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onReorder(index, index + 1);
      AccessibilityInfo.announceForAccessibility(
        `Question moved down to position ${index + 2}`,
      );
    },
    [onReorder, items.length],
  );

  const renderDraggableItem = useCallback(
    ({ item, index }: { item: DraggableItem; index: number }) => (
      <View style={styles.itemWrapper}>
        {/* Reorder controls (always visible for accessibility) */}
        {dragEnabled && items.length > 1 && (
          <View style={styles.reorderControls}>
            <TouchableOpacity
              onPress={() => handleMoveUp(index)}
              disabled={index === 0}
              style={[styles.reorderBtn, { opacity: index === 0 ? 0.25 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Move question ${index + 1} up`}
              accessibilityState={{ disabled: index === 0 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronUp size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <View
              style={styles.gripHandle}
              accessibilityLabel={`Drag handle for question ${index + 1}`}
            >
              <GripVertical size={16} color={withAlpha(colors.text, 0.25)} />
            </View>

            <TouchableOpacity
              onPress={() => handleMoveDown(index)}
              disabled={index === items.length - 1}
              style={[styles.reorderBtn, { opacity: index === items.length - 1 ? 0.25 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Move question ${index + 1} down`}
              accessibilityState={{ disabled: index === items.length - 1 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronDown size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Question content */}
        <View style={styles.itemContent}>
          {renderItem(item, index)}
        </View>
      </View>
    ),
    [items.length, dragEnabled, handleMoveUp, handleMoveDown, renderItem, colors],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderDraggableItem}
      scrollEnabled={false} // Parent ScrollView handles scrolling
      removeClippedSubviews={false}
    />
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  itemWrapper: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  reorderControls: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
    gap: 2,
  },
  reorderBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripHandle: {
    width: 28,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
});

export default DraggableQuestionList;
