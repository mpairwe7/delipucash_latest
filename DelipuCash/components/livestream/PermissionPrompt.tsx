/**
 * PermissionPrompt Component
 * Camera/microphone permission request screen
 * Design System Compliant - Clean permission UX
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, Mic, Image as ImageIcon } from 'lucide-react-native';
import { SPACING, TYPOGRAPHY, RADIUS, useTheme, withAlpha } from '@/utils/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { getResponsiveSize } from '@/utils/video-utils';

// ============================================================================
// TYPES
// ============================================================================

export interface PermissionPromptProps {
  /** Type of permission screen */
  type: 'loading' | 'request';
  /** Handler for requesting permissions */
  onRequestPermissions?: () => void;
  /** Loading message */
  loadingMessage?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PermissionPrompt = memo<PermissionPromptProps>(({
  type,
  onRequestPermissions,
  loadingMessage = 'Initializing camera...',
  title = 'Camera Access Required',
  description = 'We need permissions to access your camera, microphone, and media library to enable recording.',
}) => {
  const { colors } = useTheme();
  const iconSize = getResponsiveSize(50, 60, 70);
  const titleSize = getResponsiveSize(20, 24, 28);
  const descriptionSize = getResponsiveSize(14, 16, 18);

  if (type === 'loading') {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[
            styles.loadingText,
            { 
              color: colors.textMuted,
              fontSize: descriptionSize,
            }
          ]}>
            {loadingMessage}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Permission Icons */}
        <View style={styles.iconsContainer}>
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
            <Video size={iconSize * 0.5} color={colors.primary} />
          </View>
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.error, 0.1) }]}>
            <Mic size={iconSize * 0.5} color={colors.error} />
          </View>
          <View style={[styles.iconCircle, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
            <ImageIcon size={iconSize * 0.5} color={colors.success} />
          </View>
        </View>

        {/* Title */}
        <Text style={[
          styles.title,
          { 
            color: colors.text,
            fontSize: titleSize,
          }
        ]}>
          {title}
        </Text>

        {/* Description */}
        <Text style={[
          styles.description,
          { 
            color: colors.textMuted,
            fontSize: descriptionSize,
          }
        ]}>
          {description}
        </Text>

        {/* Permission items */}
        <View style={styles.permissionList}>
          <PermissionItem 
            icon={<Video size={20} color={colors.primary} />}
            label="Camera"
            description="Record videos"
            colors={colors}
          />
          <PermissionItem 
            icon={<Mic size={20} color={colors.error} />}
            label="Microphone"
            description="Record audio"
            colors={colors}
          />
          <PermissionItem 
            icon={<ImageIcon size={20} color={colors.success} />}
            label="Media Library"
            description="Save recordings"
            colors={colors}
          />
        </View>

        {/* Grant Button */}
        {onRequestPermissions && (
          <PrimaryButton
            title="Grant Permissions"
            onPress={onRequestPermissions}
            style={styles.button}
          />
        )}
      </View>
    </SafeAreaView>
  );
});

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface PermissionItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  colors: ReturnType<typeof useTheme>['colors'];
}

const PermissionItem = memo<PermissionItemProps>(({
  icon,
  label,
  description,
  colors,
}) => (
  <View style={styles.permissionItem}>
    <View style={[styles.permissionIcon, { backgroundColor: withAlpha(colors.border, 0.5) }]}>
      {icon}
    </View>
    <View style={styles.permissionText}>
      <Text style={[styles.permissionLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.permissionDesc, { color: colors.textMuted }]}>{description}</Text>
    </View>
  </View>
));

PermissionPrompt.displayName = 'PermissionPrompt';
PermissionItem.displayName = 'PermissionItem';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING['2xl'],
  },
  loadingText: {
    marginTop: SPACING.lg,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  iconsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING['2xl'],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  description: {
    textAlign: 'center',
    marginBottom: SPACING['2xl'],
    lineHeight: 24,
    paddingHorizontal: SPACING.lg,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  permissionList: {
    width: '100%',
    marginBottom: SPACING['2xl'],
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  permissionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.base,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  permissionText: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  permissionDesc: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  button: {
    width: '100%',
    maxWidth: 300,
  },
});

export default PermissionPrompt;
