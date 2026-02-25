/**
 * ContactCard Component
 * Card component for contact methods with interaction states
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable, Linking, Platform } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/ui/Toast';
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';
import type { ContactMethod } from '@/services/supportApi';

interface ContactCardProps {
  contact: ContactMethod;
  index?: number;
  onPress?: (contact: ContactMethod) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getContactIcon = (type: ContactMethod['type']): LucideIcon => {
  const iconMap: Record<ContactMethod['type'], LucideIcon> = {
    phone: Phone,
    email: Mail,
    whatsapp: MessageCircle,
    chat: MessageCircle,
  };
  return iconMap[type] || MessageCircle;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    containerAvailable: {
      borderColor: colors.primary,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    iconContainerAvailable: {
      backgroundColor: withAlpha(colors.primary, 0.15),
    },
    contentContainer: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xxs,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    primaryBadge: {
      marginLeft: SPACING.xs,
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderRadius: RADIUS.xs,
    },
    primaryBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
    },
    value: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
    },
    availabilityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    availabilityDot: {
      width: 6,
      height: 6,
      borderRadius: RADIUS.full,
      marginRight: SPACING.xs,
    },
    availabilityText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    arrowContainer: {
      marginLeft: SPACING.sm,
    },
  });

export const ContactCard = memo<ContactCardProps>(
  ({ contact, index = 0, onPress }) => {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const scale = useSharedValue(1);
    const styles = useMemo(() => createStyles(colors), [colors]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      scale.value = withSpring(0.97, { stiffness: 400, damping: 15 });
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, { stiffness: 400, damping: 15 });
    }, [scale]);

    const handlePress = useCallback(async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (onPress) {
        onPress(contact);
        return;
      }

      // Default linking behavior
      let url = '';
      switch (contact.type) {
        case 'phone':
          url = `tel:${contact.value}`;
          break;
        case 'email':
          url = `mailto:${contact.value}`;
          break;
        case 'whatsapp': {
          const phoneNumber = contact.value.replace(/[^0-9]/g, '');
          url =
            Platform.select({
              ios: `whatsapp://send?phone=${phoneNumber}`,
              android: `whatsapp://send?phone=${phoneNumber}`,
            }) || '';
          break;
        }
        case 'chat':
          showToast({ message: 'Live chat coming soon!', type: 'info' });
          return;
      }

      if (url) {
        try {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            showToast({
              message: `Unable to open ${contact.type}`,
              type: 'error',
            });
          }
        } catch {
          showToast({
            message: `Failed to open ${contact.type}`,
            type: 'error',
          });
        }
      }
    }, [contact, onPress, showToast]);

    const handleLongPress = useCallback(async () => {
      if (contact.value === 'in-app') return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Clipboard.setStringAsync(contact.value);
      showToast({
        message: `${contact.label} copied to clipboard`,
        type: 'success',
      });
    }, [contact.value, contact.label, showToast]);

    const Icon = getContactIcon(contact.type);

    const isAvailable =
      contact.available ||
      contact.workingHours?.toLowerCase().includes('24/7');

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(
          ANIMATION.duration.normal,
        )}
      >
        <AnimatedPressable
          style={[
            styles.container,
            animatedStyle,
            contact.available && styles.containerAvailable,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          accessibilityRole="button"
          accessibilityLabel={`${contact.label}, ${contact.value}${contact.workingHours ? `, ${contact.workingHours}` : ''}`}
          accessibilityHint={
            contact.type === 'chat'
              ? 'Coming soon'
              : `Double tap to contact via ${contact.type}. Long press to copy.`
          }
        >
          <View
            style={[
              styles.iconContainer,
              contact.available && styles.iconContainerAvailable,
            ]}
          >
            <Icon
              size={ICON_SIZE.md}
              color={
                contact.available ? colors.primary : colors.textSecondary
              }
            />
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.title}>{contact.label}</ThemedText>
              {contact.available && (
                <View style={styles.primaryBadge}>
                  <ThemedText style={styles.primaryBadgeText}>
                    Available
                  </ThemedText>
                </View>
              )}
            </View>

            <ThemedText style={styles.value}>{contact.value}</ThemedText>

            {contact.workingHours && (
              <View style={styles.availabilityContainer}>
                <View
                  style={[
                    styles.availabilityDot,
                    {
                      backgroundColor: isAvailable
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                />
                <ThemedText style={styles.availabilityText}>
                  {contact.workingHours}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.arrowContainer}>
            <ExternalLink size={ICON_SIZE.sm} color={colors.textMuted} />
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  },
);
ContactCard.displayName = 'ContactCard';
