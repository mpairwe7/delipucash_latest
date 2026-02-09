/**
 * EarningOpportunityCard Component
 * Unified card for different earning opportunities (videos, surveys, questions)
 * 
 * Design: Modern feed-style card with consistent layout
 * Features: Type indicators, reward amounts, engagement metrics
 * Accessibility: WCAG 2.2 AA compliant
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import {
  Play,
  ClipboardList,
  MessageCircleQuestion,
  Clock,
  Users,
  Coins,
  ChevronRight,
  Flame,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInRight,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  withAlpha,
} from '@/utils/theme';

export type OpportunityType = 'video' | 'survey' | 'question' | 'instant-reward';

export interface EarningOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  description?: string;
  reward: number;
  rewardType?: 'points' | 'cash';
  thumbnailUrl?: string;
  duration?: string;
  participants?: number;
  isHot?: boolean;
  isNew?: boolean;
  isLimited?: boolean;
  expiresIn?: string;
  category?: string;
}

export interface EarningOpportunityCardProps {
  opportunity: EarningOpportunity;
  onPress: (opportunity: EarningOpportunity) => void;
  variant?: 'default' | 'compact' | 'featured';
  index?: number;
  testID?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Get icon and colors for opportunity type
 */
function getTypeConfig(type: OpportunityType, colors: any) {
  switch (type) {
    case 'video':
      return {
        icon: <Play size={14} color="#FFFFFF" fill="#FFFFFF" />,
        color: '#FF6B6B',
        label: 'Watch',
      };
    case 'survey':
      return {
        icon: <ClipboardList size={14} color="#FFFFFF" />,
        color: '#4ECDC4',
        label: 'Survey',
      };
    case 'question':
      return {
        icon: <MessageCircleQuestion size={14} color="#FFFFFF" />,
        color: '#667eea',
        label: 'Answer',
      };
    case 'instant-reward':
      return {
        icon: <Zap size={14} color="#FFFFFF" fill="#FFFFFF" />,
        color: '#f093fb',
        label: 'Instant',
      };
    default:
      return {
        icon: <Coins size={14} color="#FFFFFF" />,
        color: colors.primary,
        label: 'Earn',
      };
  }
}

export function EarningOpportunityCard({
  opportunity,
  onPress,
  variant = 'default',
  index = 0,
  testID,
}: EarningOpportunityCardProps): React.ReactElement {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const typeConfig = getTypeConfig(opportunity.type, colors);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(opportunity);
  }, [opportunity, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isFeatured = variant === 'featured';
  const isCompact = variant === 'compact';

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 50).duration(300)}
    >
      <AnimatedTouchable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        style={[
          styles.card,
          isFeatured && styles.cardFeatured,
          isCompact && styles.cardCompact,
          { backgroundColor: colors.card },
          animatedStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${typeConfig.label}: ${opportunity.title}, earn ${opportunity.reward} ${opportunity.rewardType || 'points'}`}
        accessibilityHint="Tap to start earning"
        testID={testID}
      >
        {/* Thumbnail or gradient placeholder */}
        <View style={[styles.thumbnail, isCompact && styles.thumbnailCompact]}>
          {opportunity.thumbnailUrl ? (
            <Image
              source={{ uri: opportunity.thumbnailUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[typeConfig.color, withAlpha(typeConfig.color, 0.7)]}
              style={styles.thumbnailGradient}
            >
              {React.cloneElement(typeConfig.icon, {
                size: isCompact ? 20 : 28,
              })}
            </LinearGradient>
          )}
          
          {/* Type badge */}
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
            {typeConfig.icon}
            {!isCompact && (
              <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
            )}
          </View>

          {/* Duration badge for videos */}
          {opportunity.duration && (
            <View style={styles.durationBadge}>
              <Clock size={10} color="#FFFFFF" />
              <Text style={styles.durationText}>{opportunity.duration}</Text>
            </View>
          )}

          {/* Hot/New indicator */}
          {(opportunity.isHot || opportunity.isNew) && (
            <View
              style={[
                styles.hotBadge,
                { backgroundColor: opportunity.isHot ? '#FF6B6B' : '#4ECDC4' },
              ]}
            >
              {opportunity.isHot ? (
                <Flame size={10} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Zap size={10} color="#FFFFFF" />
              )}
              <Text style={styles.hotBadgeText}>
                {opportunity.isHot ? 'Hot' : 'New'}
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={[styles.content, isCompact && styles.contentCompact]}>
          {/* Title */}
          <Text
            style={[
              styles.title,
              isCompact && styles.titleCompact,
              { color: colors.text },
            ]}
            numberOfLines={isCompact ? 1 : 2}
            allowFontScaling
            maxFontSizeMultiplier={1.2}
          >
            {opportunity.title}
          </Text>

          {/* Description (not compact) */}
          {!isCompact && opportunity.description && (
            <Text
              style={[styles.description, { color: colors.textSecondary }]}
              numberOfLines={2}
              allowFontScaling
              maxFontSizeMultiplier={1.2}
            >
              {opportunity.description}
            </Text>
          )}

          {/* Meta row */}
          <View style={styles.metaRow}>
            {/* Participants */}
            {opportunity.participants !== undefined && (
              <View style={styles.metaItem}>
                <Users size={12} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {opportunity.participants.toLocaleString()}
                </Text>
              </View>
            )}

            {/* Category */}
            {opportunity.category && !isCompact && (
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: withAlpha(colors.primary, 0.1) },
                ]}
              >
                <Text style={[styles.categoryText, { color: colors.primary }]}>
                  {opportunity.category}
                </Text>
              </View>
            )}

            {/* Expiry */}
            {opportunity.expiresIn && (
              <View style={styles.metaItem}>
                <Clock size={12} color={colors.warning} />
                <Text style={[styles.metaText, { color: colors.warning }]}>
                  {opportunity.expiresIn}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Reward & CTA */}
        <View style={styles.rewardContainer}>
          <View style={styles.rewardContent}>
            <Text
              style={[styles.rewardAmount, { color: colors.success }]}
              allowFontScaling
              maxFontSizeMultiplier={1.1}
            >
              +{opportunity.reward}
            </Text>
            <Text style={[styles.rewardType, { color: colors.textMuted }]}>
              {opportunity.rewardType === 'cash' ? 'UGX' : 'pts'}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </AnimatedTouchable>
    </Animated.View>
  );
}

/**
 * Horizontal list of earning opportunities
 */
export interface EarningOpportunitiesListProps {
  opportunities: EarningOpportunity[];
  onOpportunityPress: (opportunity: EarningOpportunity) => void;
  variant?: 'default' | 'compact' | 'featured';
  emptyMessage?: string;
  testID?: string;
}

export function EarningOpportunitiesList({
  opportunities,
  onOpportunityPress,
  variant = 'compact',
  emptyMessage = 'No opportunities available',
  testID,
}: EarningOpportunitiesListProps): React.ReactElement {
  const { colors } = useTheme();

  if (opportunities.length === 0) {
    return (
      <View
        style={[styles.emptyState, { backgroundColor: colors.elevated }]}
        accessibilityRole="text"
      >
        <Coins size={24} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContainer} testID={testID}>
      {opportunities.map((opportunity, index) => (
        <EarningOpportunityCard
          key={opportunity.id}
          opportunity={opportunity}
          onPress={onOpportunityPress}
          variant={variant}
          index={index}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardFeatured: {
    ...SHADOWS.md,
  },
  cardCompact: {
    marginBottom: SPACING.xs,
  },
  thumbnail: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  thumbnailCompact: {
    width: 72,
    height: 72,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  durationBadge: {
    position: 'absolute',
    bottom: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  durationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  hotBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  hotBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: SPACING.sm,
    justifyContent: 'center',
  },
  contentCompact: {
    padding: SPACING.xs,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    marginBottom: SPACING.xxs,
  },
  titleCompact: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xxs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  metaText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  rewardContainer: {
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0, 0, 0, 0.05)',
  },
  rewardContent: {
    alignItems: 'center',
    marginBottom: SPACING.xxs,
  },
  rewardAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  rewardType: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  listContainer: {
    gap: SPACING.xs,
  },
  emptyState: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export default EarningOpportunityCard;
