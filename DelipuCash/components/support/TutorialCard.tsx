/**
 * TutorialCard Component
 * Card for displaying tutorial items with progress indicator
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
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
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  useTheme,
  withAlpha,
  type ThemeColors,
} from '@/utils/theme';
import type { Tutorial } from '@/services/supportApi';

interface TutorialCardProps {
  tutorial: Tutorial;
  index?: number;
  onPress?: (tutorial: Tutorial) => void;
  compact?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    containerCompact: {
      width: 200,
      marginRight: SPACING.sm,
    },
    thumbnailContainer: {
      position: 'relative',
      backgroundColor: colors.background,
    },
    thumbnailNormal: {
      height: 140,
    },
    thumbnailCompact: {
      height: 100,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    thumbnailPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
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
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: SPACING.xxs,
    },
    titleCompact: {
      fontSize: 13,
    },
    description: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
    },
  });

export const TutorialCard = memo<TutorialCardProps>(
  ({ tutorial, index = 0, onPress, compact = false }) => {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const [imageError, setImageError] = useState(false);
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

    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(tutorial);
    }, [tutorial, onPress]);

    const handleImageError = useCallback(() => {
      setImageError(true);
    }, []);

    return (
      <Animated.View
        entering={FadeInUp.delay(index * 70).duration(
          ANIMATION.duration.normal,
        )}
      >
        <AnimatedPressable
          style={[
            styles.container,
            animatedStyle,
            compact && styles.containerCompact,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`${tutorial.title}, ${tutorial.duration} tutorial`}
          accessibilityHint="Opens video tutorial"
        >
          <View
            style={[
              styles.thumbnailContainer,
              compact ? styles.thumbnailCompact : styles.thumbnailNormal,
            ]}
          >
            {tutorial.thumbnail && !imageError ? (
              <Image
                source={{ uri: tutorial.thumbnail }}
                style={styles.thumbnail}
                resizeMode="cover"
                onError={handleImageError}
              />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Play size={ICON_SIZE.lg} color={colors.textMuted} />
              </View>
            )}
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
                <ThemedText style={styles.durationText}>
                  {tutorial.duration}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.contentContainer}>
            <View style={styles.categoryBadge}>
              <ThemedText style={styles.categoryText}>
                {tutorial.category}
              </ThemedText>
            </View>

            <ThemedText
              style={[styles.title, compact && styles.titleCompact]}
              numberOfLines={compact ? 1 : 2}
            >
              {tutorial.title}
            </ThemedText>

            {!compact && (
              <ThemedText style={styles.description} numberOfLines={2}>
                {tutorial.description}
              </ThemedText>
            )}
          </View>
        </AnimatedPressable>
      </Animated.View>
    );
  },
);
TutorialCard.displayName = 'TutorialCard';
