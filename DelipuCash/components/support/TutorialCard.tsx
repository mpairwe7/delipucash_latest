/**
 * TutorialCard Component
 * Card for displaying tutorial items with progress indicator
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, Image } from 'react-native';
import Animated, { 
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Play, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { SPACING, RADIUS, ICON_SIZE, ANIMATION, useTheme, withAlpha } from '@/utils/theme';
import type { Tutorial } from '@/services/supportApi';

interface TutorialCardProps {
  tutorial: Tutorial;
  index?: number;
  onPress?: (tutorial: Tutorial) => void;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const TutorialCard: React.FC<TutorialCardProps> = ({
  tutorial,
  index = 0,
  onPress,
  compact = false,
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

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(tutorial);
  }, [tutorial, onPress]);

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
      width: compact ? 200 : '100%',
      marginRight: compact ? SPACING.sm : 0,
    },
    thumbnailContainer: {
      position: 'relative',
      height: compact ? 100 : 140,
      backgroundColor: colors.background,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    playButtonOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha('#000000', 0.3),
    },
    playButton: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.full,
      backgroundColor: withAlpha(colors.primary, 0.9),
      justifyContent: 'center',
      alignItems: 'center',
    },
    durationBadge: {
      position: 'absolute',
      bottom: SPACING.xs,
      right: SPACING.xs,
      backgroundColor: withAlpha('#000000', 0.7),
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      borderRadius: RADIUS.xs,
      flexDirection: 'row',
      alignItems: 'center',
    },
    durationText: {
      fontSize: 11,
      color: '#FFFFFF',
      marginLeft: 2,
    },
    completedBadge: {
      position: 'absolute',
      top: SPACING.xs,
      right: SPACING.xs,
      backgroundColor: colors.success,
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      borderRadius: RADIUS.xs,
      flexDirection: 'row',
      alignItems: 'center',
    },
    completedText: {
      fontSize: 10,
      color: '#FFFFFF',
      marginLeft: 2,
      fontWeight: '600',
    },
    contentContainer: {
      padding: SPACING.md,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: withAlpha(colors.primary, 0.1),
      paddingHorizontal: SPACING.xs,
      paddingVertical: 2,
      borderRadius: RADIUS.xs,
      marginBottom: SPACING.xs,
    },
    categoryText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    title: {
      fontSize: compact ? 13 : 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.xxs,
    },
    description: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    metaContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    metaText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    metaSeparator: {
      width: 3,
      height: 3,
      borderRadius: RADIUS.full,
      backgroundColor: colors.textMuted,
      marginHorizontal: SPACING.xs,
    },
  });

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 70).duration(ANIMATION.duration.normal)}
    >
      <AnimatedPressable
        style={[styles.container, animatedStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: tutorial.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <Play 
              size={ICON_SIZE.sm + 2} 
              color="#FFFFFF" 
              fill="#FFFFFF"
            />
          </View>
        </View>
        
        {tutorial.duration && (
          <View style={styles.durationBadge}>
            <Clock size={10} color="#FFFFFF" />
            <ThemedText style={styles.durationText}>{tutorial.duration}</ThemedText>
          </View>
        )}
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.categoryBadge}>
          <ThemedText style={styles.categoryText}>{tutorial.category}</ThemedText>
        </View>
        
        <ThemedText style={styles.title} numberOfLines={compact ? 1 : 2}>
          {tutorial.title}
        </ThemedText>
        
        {!compact && (
          <ThemedText style={styles.description} numberOfLines={2}>
            {tutorial.description}
          </ThemedText>
        )}
        
        {!compact && tutorial.duration && (
          <View style={styles.metaContainer}>
            <ThemedText style={styles.metaText}>
              Duration: {tutorial.duration}
            </ThemedText>
          </View>
        )}
      </View>
      </AnimatedPressable>
    </Animated.View>
  );
};

export default TutorialCard;
