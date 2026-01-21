/**
 * ContactCard Component
 * Card component for contact methods with interaction states
 */

import React, { useCallback } from 'react';
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

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
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

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  index = 0,
  onPress,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

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
      case 'whatsapp':
        const phoneNumber = contact.value.replace(/[^0-9]/g, '');
        url = Platform.select({
          ios: `whatsapp://send?phone=${phoneNumber}`,
          android: `whatsapp://send?phone=${phoneNumber}`,
        }) || '';
        break;
      case 'chat':
        // Handle in-app chat navigation
        break;
    }

    if (url) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      } catch (error) {
        console.error('Error opening link:', error);
      }
    }
  }, [contact, onPress]);

  const Icon = getContactIcon(contact.type);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: contact.available ? colors.primary : colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: contact.available 
        ? withAlpha(colors.primary, 0.15) 
        : colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
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
    responseTimeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    responseTimeText: {
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: SPACING.xxs,
    },
  });

  const isAvailable = contact.available || 
    contact.workingHours?.toLowerCase().includes('24/7');

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 50).duration(ANIMATION.duration.normal)}
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.iconContainer}>
        <Icon 
          size={ICON_SIZE.md} 
          color={contact.available ? colors.primary : colors.textSecondary} 
        />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>{contact.label}</ThemedText>
          {contact.available && (
            <View style={styles.primaryBadge}>
              <ThemedText style={styles.primaryBadgeText}>Available</ThemedText>
            </View>
          )}
        </View>
        
        <ThemedText style={styles.value}>{contact.value}</ThemedText>
        
        {contact.workingHours && (
          <View style={styles.availabilityContainer}>
            <View 
              style={[
                styles.availabilityDot,
                { backgroundColor: isAvailable ? colors.success : colors.warning },
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
  );
};

export default ContactCard;
