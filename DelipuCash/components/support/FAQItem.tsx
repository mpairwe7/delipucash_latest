/**
 * FAQItem Component
 * Expandable FAQ item with animation and design system compliance
 */

import React, { memo, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import * as Haptics from '@/utils/haptics';

import { ThemedText } from '@/components/themed-text';
import {
  SPACING,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  useTheme,
  type ThemeColors,
} from '@/utils/theme';
import type { FAQItem as FAQItemType } from '@/services/supportApi';

interface FAQItemProps {
  item: FAQItemType;
  onRate?: (id: string, helpful: boolean) => void;
  initialExpanded?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
    },
    questionContainer: {
      flex: 1,
      marginRight: SPACING.sm,
    },
    question: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 22,
    },
    category: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: SPACING.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chevronContainer: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.full,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    answer: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginTop: SPACING.md,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    ratingText: {
      fontSize: 13,
      color: colors.textMuted,
      marginRight: SPACING.md,
    },
    ratingButtons: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    ratingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.background,
      gap: SPACING.xs,
    },
    ratingButtonText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    ratedText: {
      fontSize: 13,
      color: colors.success,
      fontWeight: '500',
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xxs,
      marginRight: SPACING.md,
    },
    stat: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });

export const FAQItemComponent = memo<FAQItemProps>(
  ({ item, onRate, initialExpanded = false }) => {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(initialExpanded);
    const [hasRated, setHasRated] = useState(false);
    const styles = useMemo(() => createStyles(colors), [colors]);

    const rotation = useSharedValue(initialExpanded ? 180 : 0);

    const chevronStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const handlePress = useCallback(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      rotation.value = withTiming(expanded ? 0 : 180, {
        duration: ANIMATION.duration.normal,
      });
      setExpanded(!expanded);
    }, [expanded, rotation]);

    const handleRate = useCallback(
      (helpful: boolean) => {
        if (hasRated) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setHasRated(true);
        onRate?.(item.id, helpful);
      },
      [hasRated, item.id, onRate],
    );

    return (
      <Animated.View
        entering={FadeIn.duration(ANIMATION.duration.fast)}
        style={styles.container}
      >
        <AnimatedPressable
          onPress={handlePress}
          style={styles.header}
          android_ripple={{ color: colors.border }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${item.question}, ${item.category}`}
          accessibilityHint={
            expanded ? 'Double tap to collapse' : 'Double tap to expand'
          }
        >
          <View style={styles.questionContainer}>
            <ThemedText style={styles.question}>{item.question}</ThemedText>
            <ThemedText style={styles.category}>{item.category}</ThemedText>
          </View>
          <Animated.View style={[styles.chevronContainer, chevronStyle]}>
            <ChevronDown
              size={ICON_SIZE.sm}
              color={colors.textSecondary}
            />
          </Animated.View>
        </AnimatedPressable>

        {expanded && (
          <Animated.View
            entering={FadeIn.duration(ANIMATION.duration.fast)}
            style={styles.content}
          >
            <ThemedText style={styles.answer}>{item.answer}</ThemedText>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <ThumbsUp size={12} color={colors.textMuted} />
                <ThemedText style={styles.stat}>
                  {item.helpful} found this helpful
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThumbsDown size={12} color={colors.textMuted} />
                <ThemedText style={styles.stat}>
                  {item.notHelpful} not helpful
                </ThemedText>
              </View>
            </View>

            <View style={styles.ratingContainer}>
              {hasRated ? (
                <ThemedText style={styles.ratedText}>
                  Thanks for your feedback!
                </ThemedText>
              ) : (
                <>
                  <ThemedText style={styles.ratingText}>
                    Was this helpful?
                  </ThemedText>
                  <View style={styles.ratingButtons}>
                    <Pressable
                      onPress={() => handleRate(true)}
                      style={styles.ratingButton}
                      accessibilityRole="button"
                      accessibilityLabel="Yes, this was helpful"
                    >
                      <ThumbsUp size={14} color={colors.textSecondary} />
                      <ThemedText style={styles.ratingButtonText}>
                        Yes
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => handleRate(false)}
                      style={styles.ratingButton}
                      accessibilityRole="button"
                      accessibilityLabel="No, this was not helpful"
                    >
                      <ThumbsDown size={14} color={colors.textSecondary} />
                      <ThemedText style={styles.ratingButtonText}>
                        No
                      </ThemedText>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    );
  },
);
FAQItemComponent.displayName = 'FAQItemComponent';
