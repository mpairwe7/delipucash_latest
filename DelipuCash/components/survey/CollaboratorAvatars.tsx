/**
 * CollaboratorAvatars — Presence indicator for real-time survey editing
 *
 * Shows avatar bubbles of active editors with overlap stacking.
 * Displays "User X editing Q3" tooltip for locked questions.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Users } from 'lucide-react-native';
import { SPACING, RADIUS, TYPOGRAPHY, useTheme, withAlpha } from '@/utils/theme';
import type { CollabEditor } from '@/hooks/useSurveyCollab';

// ============================================================================
// TYPES
// ============================================================================

interface CollaboratorAvatarsProps {
  editors: CollabEditor[];
  /** Max avatars to show before "+N" overflow */
  maxVisible?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CollaboratorAvatars: React.FC<CollaboratorAvatarsProps> = ({
  editors,
  maxVisible = 4,
}) => {
  const { colors } = useTheme();

  if (editors.length === 0) return null;

  const visible = editors.slice(0, maxVisible);
  const overflow = editors.length - maxVisible;

  // Find who's editing what
  const editingInfo = editors.find((e) => e.lockedQuestionId);

  return (
    <View style={styles.container}>
      <View style={styles.avatarStack}>
        {visible.map((editor, index) => (
          <View
            key={editor.userId}
            style={[
              styles.avatarWrapper,
              { marginLeft: index > 0 ? -10 : 0, zIndex: visible.length - index },
            ]}
          >
            {editor.avatar ? (
              <Image
                source={{ uri: editor.avatar }}
                style={[styles.avatar, { borderColor: colors.card }]}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { borderColor: colors.card, backgroundColor: withAlpha(colors.primary, 0.15) }]}>
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {editor.firstName?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {/* Online dot */}
            <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.card }]} />
          </View>
        ))}
        {overflow > 0 && (
          <View style={[styles.avatarWrapper, { marginLeft: -10 }]}>
            <View style={[styles.avatar, styles.overflowBadge, { borderColor: colors.card, backgroundColor: withAlpha(colors.text, 0.08) }]}>
              <Text style={[styles.overflowText, { color: colors.textSecondary }]}>+{overflow}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Editing status */}
      <View style={styles.statusArea}>
        <Users size={12} color={colors.textMuted} />
        <Text style={[styles.statusText, { color: colors.textMuted }]} numberOfLines={1}>
          {editingInfo
            ? `${editingInfo.firstName} is editing`
            : `${editors.length} editor${editors.length > 1 ? 's' : ''}`}
        </Text>
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
    gap: SPACING.sm,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 11,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  overflowBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
  },
  statusArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    maxWidth: 120,
  },
});

export default CollaboratorAvatars;
