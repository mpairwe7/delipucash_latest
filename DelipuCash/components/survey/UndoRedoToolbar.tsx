/**
 * UndoRedoToolbar — Compact undo/redo controls for survey builders
 *
 * Features:
 * - Reads canUndo/canRedo from SurveyBuilderStore
 * - Haptic feedback on actions
 * - Accessible: labels, disabled state announced
 * - Respects reduced motion preference
 * - Optional multi-select bulk action buttons
 */

import React, { useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Undo2, Redo2, Copy, Trash2, X } from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, withAlpha } from '@/utils/theme';
import {
  useSurveyBuilderStore,
  selectCanUndo,
  selectCanRedo,
  selectIsMultiSelectMode,
  selectSelectedQuestionIds,
} from '@/store/SurveyBuilderStore';

// ============================================================================
// COMPONENT
// ============================================================================

interface UndoRedoToolbarProps {
  /** Show bulk action buttons when in multi-select mode */
  showBulkActions?: boolean;
}

export const UndoRedoToolbar: React.FC<UndoRedoToolbarProps> = ({ showBulkActions = true }) => {
  const { colors } = useTheme();

  // Atomic selectors — stable primitives, no re-render issues
  const canUndo = useSurveyBuilderStore(selectCanUndo);
  const canRedo = useSurveyBuilderStore(selectCanRedo);
  const isMultiSelectMode = useSurveyBuilderStore(selectIsMultiSelectMode);
  const selectedIds = useSurveyBuilderStore(selectSelectedQuestionIds);

  // Actions
  const undo = useSurveyBuilderStore((s) => s.undo);
  const redo = useSurveyBuilderStore((s) => s.redo);
  const bulkDeleteQuestions = useSurveyBuilderStore((s) => s.bulkDeleteQuestions);
  const bulkDuplicateQuestions = useSurveyBuilderStore((s) => s.bulkDuplicateQuestions);
  const clearSelection = useSurveyBuilderStore((s) => s.clearSelection);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    undo();
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    redo();
  }, [canRedo, redo]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    bulkDeleteQuestions(selectedIds);
  }, [selectedIds, bulkDeleteQuestions]);

  const handleBulkDuplicate = useCallback(() => {
    if (selectedIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bulkDuplicateQuestions(selectedIds);
  }, [selectedIds, bulkDuplicateQuestions]);

  const handleCancelSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const disabledColor = withAlpha(colors.text, 0.25);
  const activeColor = colors.text;

  // Multi-select mode: show bulk action toolbar instead
  if (showBulkActions && isMultiSelectMode) {
    return (
      <View style={[styles.container, { backgroundColor: withAlpha(colors.primary, 0.08), borderColor: withAlpha(colors.border, 0.3) }]}>
        <Text style={[styles.selectionCount, { color: colors.primary }]}>
          {selectedIds.length} selected
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleBulkDuplicate}
            disabled={selectedIds.length === 0}
            style={[styles.button, { opacity: selectedIds.length === 0 ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Duplicate ${selectedIds.length} selected questions`}
            accessibilityState={{ disabled: selectedIds.length === 0 }}
          >
            <Copy size={18} color={selectedIds.length > 0 ? colors.primary : disabledColor} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBulkDelete}
            disabled={selectedIds.length === 0}
            style={[styles.button, { opacity: selectedIds.length === 0 ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${selectedIds.length} selected questions`}
            accessibilityState={{ disabled: selectedIds.length === 0 }}
          >
            <Trash2 size={18} color={selectedIds.length > 0 ? colors.error : disabledColor} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: withAlpha(colors.border, 0.4) }]} />

          <TouchableOpacity
            onPress={handleCancelSelection}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Cancel selection"
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Default: undo/redo toolbar
  return (
    <View style={[styles.container, { backgroundColor: withAlpha(colors.card, 0.6), borderColor: withAlpha(colors.border, 0.2) }]}>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleUndo}
          disabled={!canUndo}
          style={[styles.button, { opacity: canUndo ? 1 : 0.35 }]}
          accessibilityRole="button"
          accessibilityLabel="Undo last change"
          accessibilityState={{ disabled: !canUndo }}
          accessibilityHint="Reverts the last question edit"
        >
          <Undo2 size={18} color={canUndo ? activeColor : disabledColor} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: withAlpha(colors.border, 0.3) }]} />

        <TouchableOpacity
          onPress={handleRedo}
          disabled={!canRedo}
          style={[styles.button, { opacity: canRedo ? 1 : 0.35 }]}
          accessibilityRole="button"
          accessibilityLabel="Redo last change"
          accessibilityState={{ disabled: !canRedo }}
          accessibilityHint="Re-applies the last undone change"
        >
          <Redo2 size={18} color={canRedo ? activeColor : disabledColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.base,
    borderWidth: 1,
    minHeight: 40,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
  },
  selectionCount: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '600' as const,
  },
});

export default UndoRedoToolbar;
