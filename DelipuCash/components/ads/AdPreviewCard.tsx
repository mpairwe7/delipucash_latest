/**
 * AdPreviewCard - Real-Time Ad Preview for Ad Creation
 * 
 * Industry-standard ad preview component that shows advertisers
 * how their ad will appear before submission.
 * 
 * Features:
 * - Multiple preview variants (banner, native, video, story)
 * - Device frame simulation (iPhone/Android)
 * - Dark/light mode preview
 * - Real-time updates from form data
 * - Platform-specific previews
 * - Interactive elements disabled
 * - Accessibility labels for preview context
 * 
 * @example
 * ```tsx
 * <AdPreviewCard
 *   ad={formData}
 *   variant="native"
 *   deviceType="iphone"
 *   showDeviceFrame
 * />
 * ```
 */

import React, { memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  VolumeX,
  ExternalLink,
  Clock,
  Eye,
  Smartphone,
  Monitor,
  MoreVertical,
  ThumbsUp,
  MessageCircle,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  withAlpha,
} from '@/utils/theme';
import type { Ad } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type PreviewVariant = 
  | 'banner'
  | 'native'
  | 'video'
  | 'story'
  | 'interstitial'
  | 'feed'
  | 'question'
  | 'compact';

export type DeviceType = 'iphone' | 'android' | 'tablet' | 'desktop';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AdPreviewData {
  title?: string;
  description?: string;
  callToAction?: string;
  imageUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  targetUrl?: string;
  userName?: string;
  userAvatar?: string;
  budget?: number;
  duration?: number;
}

export interface AdPreviewCardProps {
  /** Ad data for preview */
  ad: AdPreviewData | Partial<Ad>;
  /** Preview variant */
  variant?: PreviewVariant;
  /** Device type for frame */
  deviceType?: DeviceType;
  /** Show device frame around preview */
  showDeviceFrame?: boolean;
  /** Preview theme mode */
  themeMode?: ThemeMode;
  /** Show variant tabs */
  showVariantTabs?: boolean;
  /** Variant change callback */
  onVariantChange?: (variant: PreviewVariant) => void;
  /** Custom style */
  style?: any;
  /** Scale factor (0-1) */
  scale?: number;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEVICE_FRAMES = {
  iphone: {
    width: 375,
    height: 667,
    borderRadius: 44,
    notchHeight: 44,
    homeIndicator: 34,
  },
  android: {
    width: 360,
    height: 640,
    borderRadius: 20,
    notchHeight: 24,
    homeIndicator: 0,
  },
  tablet: {
    width: 768,
    height: 1024,
    borderRadius: 20,
    notchHeight: 20,
    homeIndicator: 20,
  },
  desktop: {
    width: 1280,
    height: 720,
    borderRadius: 8,
    notchHeight: 0,
    homeIndicator: 0,
  },
};

const CTA_LABELS: Record<string, string> = {
  learn_more: 'Learn More',
  shop_now: 'Shop Now',
  sign_up: 'Sign Up',
  download: 'Download',
  get_offer: 'Get Offer',
  book_now: 'Book Now',
  apply_now: 'Apply Now',
  subscribe: 'Subscribe',
  watch_video: 'Watch Video',
  contact_us: 'Contact Us',
};

const VARIANT_TABS = [
  { id: 'native', label: 'Native', icon: Sparkles },
  { id: 'banner', label: 'Banner', icon: Monitor },
  { id: 'video', label: 'Video', icon: Play },
  { id: 'story', label: 'Story', icon: Smartphone },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Banner Preview
const BannerPreview: React.FC<{ ad: AdPreviewData; colors: any }> = memo(({ ad, colors }) => (
  <View style={[previewStyles.bannerContainer, { backgroundColor: colors.card }]}>
    <View style={previewStyles.bannerContent}>
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={previewStyles.bannerImage} />
      ) : (
        <View style={[previewStyles.bannerImagePlaceholder, { backgroundColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary }}>Ad Image</Text>
        </View>
      )}
      <View style={previewStyles.bannerTextContent}>
        <View style={[previewStyles.sponsoredBadge, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
          <Text style={[previewStyles.sponsoredText, { color: colors.primary }]}>Sponsored</Text>
        </View>
        <Text style={[previewStyles.bannerTitle, { color: colors.text }]} numberOfLines={1}>
          {ad.title || 'Your Ad Title'}
        </Text>
        <Text style={[previewStyles.bannerDescription, { color: colors.textSecondary }]} numberOfLines={2}>
          {ad.description || 'Your ad description will appear here...'}
        </Text>
      </View>
      <TouchableOpacity
        style={[previewStyles.bannerCTA, { backgroundColor: colors.primary }]}
        disabled
      >
        <Text style={previewStyles.bannerCTAText}>
          {CTA_LABELS[ad.callToAction || 'learn_more'] || 'Learn More'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
));
BannerPreview.displayName = 'BannerPreview';

// Native/Feed Preview
const NativePreview: React.FC<{ ad: AdPreviewData; colors: any }> = memo(({ ad, colors }) => (
  <View style={[previewStyles.nativeContainer, { backgroundColor: colors.card }]}>
    {/* Header */}
    <View style={previewStyles.nativeHeader}>
      {ad.userAvatar ? (
        <Image source={{ uri: ad.userAvatar }} style={previewStyles.nativeAvatar} />
      ) : (
        <View style={[previewStyles.nativeAvatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={previewStyles.nativeAvatarText}>
            {(ad.userName || 'A')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={previewStyles.nativeHeaderText}>
        <View style={previewStyles.nativeNameRow}>
          <Text style={[previewStyles.nativeName, { color: colors.text }]}>
            {ad.userName || 'Advertiser Name'}
          </Text>
          <View style={[previewStyles.sponsoredPill, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
            <Text style={[previewStyles.sponsoredPillText, { color: colors.primary }]}>Sponsored</Text>
          </View>
        </View>
        <Text style={[previewStyles.nativeTimestamp, { color: colors.textSecondary }]}>
          Promoted
        </Text>
      </View>
      <TouchableOpacity style={previewStyles.nativeMore} disabled>
        <MoreVertical size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>

    {/* Content */}
    <Text style={[previewStyles.nativeTitle, { color: colors.text }]} numberOfLines={2}>
      {ad.title || 'Your Ad Title'}
    </Text>
    
    {ad.description && (
      <Text style={[previewStyles.nativeDescription, { color: colors.textSecondary }]} numberOfLines={3}>
        {ad.description}
      </Text>
    )}

    {/* Image */}
    <View style={previewStyles.nativeImageContainer}>
      {ad.imageUrl ? (
        <Image source={{ uri: ad.imageUrl }} style={previewStyles.nativeImage} />
      ) : (
        <View style={[previewStyles.nativeImagePlaceholder, { backgroundColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary }}>Ad Image Preview</Text>
        </View>
      )}
    </View>

    {/* CTA */}
    <TouchableOpacity
      style={[previewStyles.nativeCTA, { backgroundColor: colors.primary }]}
      disabled
    >
      <Text style={previewStyles.nativeCTAText}>
        {CTA_LABELS[ad.callToAction || 'learn_more'] || 'Learn More'}
      </Text>
      <ExternalLink size={16} color="#FFFFFF" />
    </TouchableOpacity>

    {/* Engagement Row */}
    <View style={previewStyles.nativeEngagement}>
      <View style={previewStyles.engagementItem}>
        <ThumbsUp size={18} color={colors.textSecondary} />
        <Text style={[previewStyles.engagementText, { color: colors.textSecondary }]}>Like</Text>
      </View>
      <View style={previewStyles.engagementItem}>
        <MessageCircle size={18} color={colors.textSecondary} />
        <Text style={[previewStyles.engagementText, { color: colors.textSecondary }]}>Comment</Text>
      </View>
      <View style={previewStyles.engagementItem}>
        <Share2 size={18} color={colors.textSecondary} />
        <Text style={[previewStyles.engagementText, { color: colors.textSecondary }]}>Share</Text>
      </View>
    </View>
  </View>
));
NativePreview.displayName = 'NativePreview';

// Video Preview
const VideoPreview: React.FC<{ ad: AdPreviewData; colors: any }> = memo(({ ad, colors }) => (
  <View style={previewStyles.videoContainer}>
    {/* Video Thumbnail */}
    <View style={previewStyles.videoThumbnailContainer}>
      {ad.thumbnailUrl || ad.imageUrl ? (
        <Image 
          source={{ uri: ad.thumbnailUrl || ad.imageUrl }} 
          style={previewStyles.videoThumbnail} 
        />
      ) : (
        <View style={[previewStyles.videoThumbnailPlaceholder, { backgroundColor: '#000' }]}>
          <Play size={48} color="#FFFFFF" fill="rgba(255,255,255,0.3)" />
        </View>
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={previewStyles.videoGradient}
      />

      {/* Play Button */}
      <View style={previewStyles.videoPlayButton}>
        <View style={previewStyles.videoPlayButtonBg}>
          <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
        </View>
      </View>

      {/* Ad Badge */}
      <View style={previewStyles.videoAdBadge}>
        <Text style={previewStyles.videoAdBadgeText}>AD</Text>
      </View>

      {/* Skip Button */}
      <View style={previewStyles.videoSkipButton}>
        <Clock size={14} color="#FFFFFF" />
        <Text style={previewStyles.videoSkipText}>5s</Text>
      </View>

      {/* Mute Button */}
      <TouchableOpacity style={previewStyles.videoMuteButton} disabled>
        <VolumeX size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Progress Bar */}
      <View style={previewStyles.videoProgressContainer}>
        <View style={previewStyles.videoProgressTrack}>
          <View style={[previewStyles.videoProgressFill, { width: '30%', backgroundColor: colors.primary }]} />
        </View>
      </View>

      {/* Bottom Info */}
      <View style={previewStyles.videoBottomInfo}>
        <Text style={previewStyles.videoTitle} numberOfLines={1}>
          {ad.title || 'Your Video Ad Title'}
        </Text>
        <TouchableOpacity style={[previewStyles.videoCTA, { backgroundColor: colors.primary }]} disabled>
          <Text style={previewStyles.videoCTAText}>
            {CTA_LABELS[ad.callToAction || 'learn_more'] || 'Learn More'}
          </Text>
          <ExternalLink size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
));
VideoPreview.displayName = 'VideoPreview';

// Story Preview
const StoryPreview: React.FC<{ ad: AdPreviewData; colors: any }> = memo(({ ad, colors }) => (
  <View style={previewStyles.storyContainer}>
    {/* Story Background */}
    <View style={previewStyles.storyBackground}>
      {ad.imageUrl || ad.thumbnailUrl ? (
        <Image 
          source={{ uri: ad.imageUrl || ad.thumbnailUrl }} 
          style={previewStyles.storyImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[colors.primary, withAlpha(colors.primary, 0.7)]}
          style={previewStyles.storyPlaceholder}
        />
      )}

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.2, 0.6, 1]}
        style={previewStyles.storyGradient}
      />
    </View>

    {/* Progress Bars */}
    <View style={previewStyles.storyProgressRow}>
      {[1, 2, 3, 4, 5].map((_, i) => (
        <View key={i} style={previewStyles.storyProgressSegment}>
          <View 
            style={[
              previewStyles.storyProgressFill, 
              { width: i === 0 ? '60%' : '0%' }
            ]} 
          />
        </View>
      ))}
    </View>

    {/* Header */}
    <View style={previewStyles.storyHeader}>
      <View style={previewStyles.storyUserInfo}>
        {ad.userAvatar ? (
          <Image source={{ uri: ad.userAvatar }} style={previewStyles.storyAvatar} />
        ) : (
          <View style={[previewStyles.storyAvatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
              {(ad.userName || 'A')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={previewStyles.storyUserName}>{ad.userName || 'Advertiser'}</Text>
        <View style={previewStyles.storySponsoredBadge}>
          <Text style={previewStyles.storySponsoredText}>Sponsored</Text>
        </View>
      </View>
    </View>

    {/* Bottom Content */}
    <View style={previewStyles.storyBottom}>
      <Text style={previewStyles.storyTitle} numberOfLines={2}>
        {ad.title || 'Your Story Ad Title'}
      </Text>
      
      {/* Swipe Up CTA */}
      <View style={previewStyles.storySwipeUp}>
        <View style={[previewStyles.storySwipeButton, { backgroundColor: colors.primary }]}>
          <Text style={previewStyles.storySwipeText}>
            {CTA_LABELS[ad.callToAction || 'learn_more'] || 'Learn More'}
          </Text>
        </View>
        <Text style={previewStyles.storySwipeHint}>Swipe up</Text>
      </View>
    </View>
  </View>
));
StoryPreview.displayName = 'StoryPreview';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AdPreviewCardComponent: React.FC<AdPreviewCardProps> = ({
  ad,
  variant = 'native',
  deviceType = 'iphone',
  showDeviceFrame = true,
  themeMode = 'light',
  showVariantTabs = true,
  onVariantChange,
  style,
  scale = 0.65,
  testID,
}) => {
  const { colors, isDark } = useTheme();

  // Use preview theme colors
  const previewColors = useMemo(() => {
    const useDark = themeMode === 'dark' || (themeMode === 'system' && isDark);
    return {
      background: useDark ? '#121212' : '#FFFFFF',
      card: useDark ? '#1E1E1E' : '#FFFFFF',
      text: useDark ? '#FFFFFF' : '#1A1A1A',
      textSecondary: useDark ? '#A0A0A0' : '#666666',
      primary: colors.primary,
      border: useDark ? '#333333' : '#E5E5E5',
    };
  }, [themeMode, isDark, colors.primary]);

  const deviceFrame = DEVICE_FRAMES[deviceType];
  const previewWidth = deviceFrame.width * scale;
  const previewHeight = deviceFrame.height * scale;

  // Normalize ad data to AdPreviewData format (handle null -> undefined)
  const normalizedAd: AdPreviewData = useMemo(() => ({
    title: ad.title ?? undefined,
    description: ad.description ?? undefined,
    callToAction: (ad as AdPreviewData).callToAction ?? (ad as Partial<Ad>).callToAction ?? undefined,
    imageUrl: ad.imageUrl ?? undefined,
    videoUrl: ad.videoUrl ?? undefined,
    thumbnailUrl: (ad as AdPreviewData).thumbnailUrl ?? (ad as Partial<Ad>).thumbnailUrl ?? undefined,
    targetUrl: (ad as AdPreviewData).targetUrl ?? (ad as Partial<Ad>).targetUrl ?? undefined,
    userName: (ad as AdPreviewData).userName ?? undefined,
    userAvatar: (ad as AdPreviewData).userAvatar ?? undefined,
    budget: (ad as AdPreviewData).budget ?? (ad as Partial<Ad>).totalBudget ?? undefined,
    duration: (ad as AdPreviewData).duration ?? undefined,
  }), [ad]);

  // Render preview based on variant
  const renderPreview = () => {
    switch (variant) {
      case 'banner':
        return <BannerPreview ad={normalizedAd} colors={previewColors} />;
      case 'video':
        return <VideoPreview ad={normalizedAd} colors={previewColors} />;
      case 'story':
        return <StoryPreview ad={normalizedAd} colors={previewColors} />;
      case 'native':
      case 'feed':
      case 'question':
      default:
        return <NativePreview ad={normalizedAd} colors={previewColors} />;
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Variant Tabs */}
      {showVariantTabs && (
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContent}
          >
            {VARIANT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = variant === tab.id;
              
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.tab,
                    { backgroundColor: isActive ? withAlpha(colors.primary, 0.1) : 'transparent' },
                  ]}
                  onPress={() => onVariantChange?.(tab.id as PreviewVariant)}
                  accessibilityLabel={`Preview as ${tab.label}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Icon 
                    size={18} 
                    color={isActive ? colors.primary : colors.textSecondary} 
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: isActive ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Preview Container */}
      <View style={styles.previewOuterContainer}>
        <Animated.View
          style={[
            styles.previewContainer,
            showDeviceFrame && {
              width: previewWidth + 12,
              height: previewHeight + 12,
              borderRadius: deviceFrame.borderRadius * scale,
              borderWidth: 4,
              borderColor: '#333',
            },
          ]}
          entering={FadeInDown.duration(300)}
        >
          {/* Device Frame Content */}
          <View
            style={[
              styles.deviceScreen,
              { backgroundColor: previewColors.background },
              showDeviceFrame && {
                width: previewWidth,
                height: previewHeight,
                borderRadius: (deviceFrame.borderRadius - 4) * scale,
              },
            ]}
          >
            {/* Notch (iPhone) */}
            {showDeviceFrame && deviceType === 'iphone' && (
              <View style={[styles.notch, { height: deviceFrame.notchHeight * scale }]} />
            )}

            {/* Status Bar Mock */}
            {showDeviceFrame && (
              <View style={styles.statusBar}>
                <Text style={styles.statusBarTime}>9:41</Text>
              </View>
            )}

            {/* Preview Content */}
            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {renderPreview()}
            </ScrollView>

            {/* Home Indicator (iPhone) */}
            {showDeviceFrame && deviceType === 'iphone' && (
              <View style={styles.homeIndicator}>
                <View style={styles.homeIndicatorBar} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Preview Label */}
        <View style={styles.previewLabel}>
          <Eye size={14} color={colors.textSecondary} />
          <Text style={[styles.previewLabelText, { color: colors.textSecondary }]}>
            Preview - {variant.charAt(0).toUpperCase() + variant.slice(1)}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },

  // Tabs
  tabsContainer: {
    marginBottom: SPACING.md,
    width: '100%',
  },
  tabsContent: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  tabLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // Preview Container
  previewOuterContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewContainer: {
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  deviceScreen: {
    overflow: 'hidden',
  },
  notch: {
    width: '40%',
    alignSelf: 'center',
    backgroundColor: '#000',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  statusBar: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  statusBarTime: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    padding: SPACING.sm,
  },
  homeIndicator: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeIndicatorBar: {
    width: 100,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  previewLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  previewLabelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

// Preview-specific styles
const previewStyles = StyleSheet.create({
  // Banner
  bannerContainer: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    overflow: 'hidden',
  },
  bannerContent: {
    gap: SPACING.sm,
  },
  bannerImage: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.sm,
  },
  bannerImagePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextContent: {
    gap: 4,
  },
  sponsoredBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sponsoredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bannerDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  bannerCTA: {
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  bannerCTAText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Native
  nativeContainer: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  nativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nativeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  nativeAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeAvatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  nativeHeaderText: {
    flex: 1,
  },
  nativeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nativeName: {
    fontWeight: '600',
    fontSize: 13,
  },
  sponsoredPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sponsoredPillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  nativeTimestamp: {
    fontSize: 11,
  },
  nativeMore: {
    padding: 4,
  },
  nativeTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  nativeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  nativeImageContainer: {
    marginHorizontal: -SPACING.sm,
  },
  nativeImage: {
    width: '100%',
    height: 160,
  },
  nativeImagePlaceholder: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  nativeCTAText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  nativeEngagement: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  engagementText: {
    fontSize: 11,
  },

  // Video
  videoContainer: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  videoThumbnailContainer: {
    height: 200,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
  videoPlayButtonBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoAdBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoAdBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  videoSkipButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  videoSkipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  videoMuteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoProgressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  videoProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  videoProgressFill: {
    height: '100%',
  },
  videoBottomInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 60,
    gap: 6,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  videoCTAText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Story
  storyContainer: {
    height: 400,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  storyBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyPlaceholder: {
    width: '100%',
    height: '100%',
  },
  storyGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  storyProgressRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  storyProgressSegment: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  storyProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  storyHeader: {
    position: 'absolute',
    top: 20,
    left: 8,
    right: 8,
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storyAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyUserName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  storySponsoredBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  storySponsoredText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  storyBottom: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 12,
    gap: SPACING.md,
  },
  storyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    lineHeight: 24,
  },
  storySwipeUp: {
    alignItems: 'center',
    gap: 6,
  },
  storySwipeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
  },
  storySwipeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  storySwipeHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const AdPreviewCard = memo(AdPreviewCardComponent);
export default AdPreviewCard;
