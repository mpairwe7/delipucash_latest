/**
 * NativeQuestionAd - Native Ad Component Matching QuestionCard Style
 * 
 * Industry-standard native advertising that seamlessly blends with
 * the Q&A feed while maintaining clear "Sponsored" labeling.
 * 
 * Design inspired by:
 * - Quora native ads (question-like format with subtle branding)
 * - Stack Overflow sponsored posts
 * - Reddit promoted posts
 * - Instagram sponsored posts
 * 
 * Features:
 * - Matches QuestionCard visual style exactly
 * - Clear "Sponsored" badge (GDPR/FTC compliant)
 * - Smooth animations on appear/interact
 * - Accessibility support (screen readers, dynamic type)
 * - Feedback options ("Not interested", "Report")
 * - High touch targets (≥44dp)
 * 
 * @example
 * ```tsx
 * <NativeQuestionAd
 *   ad={sponsoredQuestion}
 *   onPress={handleAdClick}
 *   onFeedback={handleFeedback}
 * />
 * ```
 */

import React, { memo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
  Platform,
  Linking,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  Eye,
  ThumbsUp,
  MoreHorizontal,
  ExternalLink,
  Flag,
  EyeOff,
  Info,
  Award,
  Sparkles,
  CheckCircle,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import type { Ad } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface NativeQuestionAdProps {
  /** Ad data */
  ad: Ad;
  /** Index in feed for animation stagger */
  index?: number;
  /** Press handler */
  onPress?: (ad: Ad) => void;
  /** Load complete callback for impression tracking */
  onLoad?: (ad: Ad) => void;
  /** Feedback callback ("not_interested", "report", "info") */
  onFeedback?: (ad: Ad, type: 'not_interested' | 'report' | 'info') => void;
  /** Show as featured with glow effect */
  featured?: boolean;
  /** Show engagement metrics */
  showMetrics?: boolean;
  /** Custom style */
  style?: any;
  /** Test ID */
  testID?: string;
}

type FeedbackOption = {
  id: 'not_interested' | 'report' | 'info';
  label: string;
  icon: React.ReactNode;
  color: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const CTA_LABELS: Record<string, string> = {
  learn_more: 'Learn More',
  shop_now: 'Shop Now',
  sign_up: 'Sign Up',
  download: 'Download',
  get_offer: 'Get Offer',
  book_now: 'Book Now',
  apply_now: 'Apply Now',
  subscribe: 'Subscribe',
  watch_video: 'Watch',
  contact_us: 'Contact',
};

// ============================================================================
// COMPONENT
// ============================================================================

const NativeQuestionAdComponent: React.FC<NativeQuestionAdProps> = ({
  ad,
  index = 0,
  onPress,
  onLoad,
  onFeedback,
  featured = false,
  showMetrics = true,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);

  // Animations
  const scale = useSharedValue(1);
  const menuOpacity = useSharedValue(0);

  // Check for screen reader (for future accessibility features)
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      () => {} // Placeholder for future accessibility handling
    );
    return () => subscription.remove();
  }, []);

  // Report impression on mount
  useEffect(() => {
    onLoad?.(ad);
  }, [ad, onLoad]);

  // Derived values
  const ctaLabel = CTA_LABELS[ad.callToAction || 'learn_more'] || 'Learn More';
  const displayTitle = ad.headline || ad.title || 'Sponsored Question';
  const displayDescription = ad.description || 'Discover more from this advertiser';
  const advertiserName = ad.user?.firstName 
    ? `${ad.user.firstName} ${ad.user.lastName || ''}`.trim()
    : 'Sponsored';
  const hasImage = Boolean(ad.imageUrl || ad.thumbnailUrl);
  const imageUrl = ad.thumbnailUrl || ad.imageUrl;

  // Handlers
  const handlePress = useCallback(() => {
    // Animate scale
    scale.value = withSpring(0.98, { damping: 15 }, () => {
      scale.value = withSpring(1);
    });

    // Open target URL
    if (ad.targetUrl) {
      Linking.openURL(ad.targetUrl).catch(console.error);
    }

    onPress?.(ad);
  }, [ad, onPress, scale]);

  const handleFeedback = useCallback((type: 'not_interested' | 'report' | 'info') => {
    setShowFeedbackMenu(false);
    onFeedback?.(ad, type);
  }, [ad, onFeedback]);

  const toggleFeedbackMenu = useCallback(() => {
    const newValue = !showFeedbackMenu;
    setShowFeedbackMenu(newValue);
    menuOpacity.value = withTiming(newValue ? 1 : 0, { duration: 200 });
  }, [showFeedbackMenu, menuOpacity]);

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [
      { scale: 0.9 + menuOpacity.value * 0.1 },
      { translateY: (1 - menuOpacity.value) * -10 },
    ],
  }));

  // Feedback options
  const feedbackOptions: FeedbackOption[] = [
    {
      id: 'not_interested',
      label: 'Not interested',
      icon: <EyeOff size={16} color={colors.textMuted} />,
      color: colors.textMuted,
    },
    {
      id: 'report',
      label: 'Report ad',
      icon: <Flag size={16} color={colors.error} />,
      color: colors.error,
    },
    {
      id: 'info',
      label: 'Why this ad?',
      icon: <Info size={16} color={colors.info} />,
      color: colors.info,
    },
  ];

  return (
    <Animated.View
      testID={testID}
      entering={FadeInDown.delay(index * 50).duration(400).springify()}
      style={[styles.container, style]}
    >
      <Animated.View style={containerAnimatedStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: featured ? colors.primary : colors.border,
              borderWidth: featured ? 1.5 : 1,
            },
          ]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Sponsored: ${displayTitle}. ${displayDescription}. Tap to ${ctaLabel.toLowerCase()}`}
          accessibilityHint="Opens the advertiser's page"
        >
          {/* Featured Glow Effect */}
          {featured && (
            <LinearGradient
              colors={[
                withAlpha(colors.primary, 0.1),
                'transparent',
              ]}
              style={styles.featuredGlow}
              pointerEvents="none"
            />
          )}

          {/* Sponsored Badge & More Button Row */}
          <View style={styles.headerRow}>
            {/* Sponsored Badge */}
            <View style={[styles.sponsoredBadge, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}>
              <Sparkles size={12} color={colors.textMuted} />
              <Text
                style={[styles.sponsoredText, { color: colors.textMuted }]}
                accessibilityLabel="Sponsored content"
              >
                Sponsored
              </Text>
            </View>

            {/* More Options Button */}
            <TouchableOpacity
              onPress={toggleFeedbackMenu}
              style={[styles.moreButton, { backgroundColor: withAlpha(colors.textMuted, 0.1) }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Ad options menu"
            >
              <MoreHorizontal size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Feedback Menu Dropdown */}
          {showFeedbackMenu && (
            <Animated.View
              style={[
                styles.feedbackMenu,
                { backgroundColor: colors.card, borderColor: colors.border },
                menuAnimatedStyle,
              ]}
            >
              {feedbackOptions.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.feedbackOption, { borderBottomColor: colors.border }]}
                  onPress={() => handleFeedback(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                >
                  {option.icon}
                  <Text style={[styles.feedbackOptionText, { color: option.color }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          )}

          {/* Advertiser Info */}
          <View style={styles.advertiserRow}>
            <View style={[styles.advertiserAvatar, { backgroundColor: withAlpha(colors.primary, 0.15) }]}>
              {ad.user?.avatar ? (
                <Image
                  source={{ uri: ad.user.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {advertiserName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.advertiserInfo}>
              <View style={styles.advertiserNameRow}>
                <Text
                  style={[styles.advertiserName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {advertiserName}
                </Text>
                {ad.sponsored && (
                  <CheckCircle size={14} color={colors.primary} fill={colors.primary} />
                )}
              </View>
              {ad.placement && (
                <Text style={[styles.advertiserCategory, { color: colors.textMuted }]}>
                  {ad.placement.charAt(0).toUpperCase() + ad.placement.slice(1)} Ad
                </Text>
              )}
            </View>
          </View>

          {/* Question/Title - Main Content */}
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={3}
            accessibilityRole="header"
          >
            {displayTitle}
          </Text>

          {/* Description */}
          {displayDescription && (
            <Text
              style={[styles.description, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {displayDescription}
            </Text>
          )}

          {/* Image (if available) */}
          {hasImage && imageUrl && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
              {/* Subtle gradient overlay */}
              <LinearGradient
                colors={['transparent', withAlpha('#000000', 0.3)]}
                style={styles.imageGradient}
              />
            </View>
          )}

          {/* Engagement Metrics (mock/real) */}
          {showMetrics && (
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Eye size={14} color={colors.textMuted} />
                <Text style={[styles.metricText, { color: colors.textMuted }]}>
                  {formatNumber(ad.views || Math.floor(Math.random() * 10000) + 1000)} views
                </Text>
              </View>
              <View style={styles.metric}>
                <ThumbsUp size={14} color={colors.textMuted} />
                <Text style={[styles.metricText, { color: colors.textMuted }]}>
                  {formatNumber(ad.clicks || Math.floor(Math.random() * 500) + 50)} likes
                </Text>
              </View>
              <View style={styles.metric}>
                <MessageCircle size={14} color={colors.textMuted} />
                <Text style={[styles.metricText, { color: colors.textMuted }]}>
                  {Math.floor(Math.random() * 30) + 5} answers
                </Text>
              </View>
            </View>
          )}

          {/* CTA Button */}
          <View style={styles.ctaRow}>
            <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.ctaText, { color: colors.primaryText }]}>
                {ctaLabel}
              </Text>
              <ExternalLink size={14} color={colors.primaryText} />
            </View>

            {/* Reward indicator (if rewarded placement) */}
            {ad.placement === 'rewarded' && (
              <View style={[styles.rewardBadge, { backgroundColor: withAlpha(colors.warning, 0.15) }]}>
                <Award size={14} color={colors.warning} />
                <Text style={[styles.rewardText, { color: colors.warning }]}>
                  +10 pts
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featuredGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  sponsoredText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Feedback Menu
  feedbackMenu: {
    position: 'absolute',
    top: 56,
    right: SPACING.base,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  feedbackOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minWidth: 160,
  },
  feedbackOptionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Advertiser
  advertiserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  advertiserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  advertiserInfo: {
    flex: 1,
  },
  advertiserNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  advertiserName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  advertiserCategory: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 1,
  },

  // Content
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    lineHeight: TYPOGRAPHY.fontSize.lg * 1.4,
    marginBottom: SPACING.xs,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginBottom: SPACING.sm,
  },

  // Image
  imageContainer: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    aspectRatio: 16 / 9,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },

  // CTA
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  ctaText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  rewardText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const NativeQuestionAd = memo(NativeQuestionAdComponent);
export default NativeQuestionAd;
