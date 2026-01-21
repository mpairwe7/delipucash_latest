/**
 * ProfileSupportCard Component
 * Card for navigating to Help & Support from profile screen
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { 
  HelpCircle, 
  ChevronRight,
  MessageCircle,
  Book,
  Headphones,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';

interface ProfileSupportCardProps {
  index?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ProfileSupportCard: React.FC<ProfileSupportCardProps> = ({
  index = 0,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { stiffness: 400, damping: 15 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/help-support' as any);
  }, [router]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.lg,
      backgroundColor: withAlpha(colors.primary, 0.12),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    arrow: {
      opacity: 0.5,
    },
    features: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    feature: {
      flex: 1,
      alignItems: 'center',
    },
    featureIconContainer: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    featureLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  const features = [
    { icon: HelpCircle, label: 'FAQs', color: colors.info },
    { icon: MessageCircle, label: 'Chat', color: colors.success },
    { icon: Book, label: 'Guides', color: colors.warning },
    { icon: Headphones, label: 'Support', color: colors.primary },
  ];

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 50).duration(ANIMATION.duration.normal)}
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <HelpCircle size={ICON_SIZE.md} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>Help & Support</ThemedText>
          <ThemedText style={styles.subtitle}>FAQs, tutorials & contact us</ThemedText>
        </View>
        <View style={styles.arrow}>
          <ChevronRight size={ICON_SIZE.sm} color={colors.textSecondary} />
        </View>
      </View>

      <View style={styles.features}>
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <View key={idx} style={styles.feature}>
              <View style={styles.featureIconContainer}>
                <Icon size={ICON_SIZE.sm} color={feature.color} />
              </View>
              <ThemedText style={styles.featureLabel}>{feature.label}</ThemedText>
            </View>
          );
        })}
      </View>
    </AnimatedPressable>
  );
};

export default ProfileSupportCard;
