/**
 * PreLiveLobby Component
 * Shown before going live — lets user set title and preview camera
 */

import React, { memo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Radio, Crown } from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, withAlpha } from '@/utils/theme';
import { formatDuration } from '@/utils/video-utils';

export interface PreLiveLobbyProps {
  /** Callback when user taps "Go Live" */
  onGoLive: (title: string) => void;
  /** Callback to cancel and close */
  onCancel: () => void;
  /** Maximum livestream duration in seconds */
  maxDuration: number;
  /** Whether user has premium */
  hasVideoPremium: boolean;
}

export const PreLiveLobby = memo<PreLiveLobbyProps>(({
  onGoLive,
  onCancel,
  maxDuration,
  hasVideoPremium,
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');

  const handleGoLive = useCallback(() => {
    onGoLive(title.trim() || 'Live Stream');
  }, [title, onGoLive]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.heading, { color: '#fff' }]}>Go Live</Text>
        <Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.7)' }]}>
          Set a title for your livestream
        </Text>

        {/* Title input */}
        <TextInput
          style={[styles.input, { borderColor: withAlpha(colors.border, 0.5), color: '#fff' }]}
          placeholder="Enter a title..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          returnKeyType="done"
          autoFocus
        />

        {/* Duration info */}
        <View style={styles.infoRow}>
          {hasVideoPremium && (
            <View style={[styles.premiumBadge, { backgroundColor: withAlpha(colors.warning, 0.2) }]}>
              <Crown size={14} color={colors.warning} />
              <Text style={[styles.premiumText, { color: colors.warning }]}>Premium</Text>
            </View>
          )}
          <Text style={styles.durationText}>
            Max duration: {formatDuration(maxDuration)}
          </Text>
        </View>

        {/* Go Live button */}
        <TouchableOpacity
          style={[styles.goLiveButton, { backgroundColor: colors.error }]}
          onPress={handleGoLive}
          activeOpacity={0.8}
        >
          <Radio size={20} color="#fff" />
          <Text style={styles.goLiveText}>Go Live</Text>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

PreLiveLobby.displayName = 'PreLiveLobby';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  content: {
    width: '85%',
    maxWidth: 360,
    alignItems: 'center',
    padding: SPACING.xl,
  },
  heading: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  premiumText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  durationText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  goLiveText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  cancelButton: {
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: TYPOGRAPHY.fontSize.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

export default PreLiveLobby;
