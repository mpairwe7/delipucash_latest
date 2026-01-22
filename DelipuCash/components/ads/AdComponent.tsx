/**
 * AdComponent - Comprehensive Ad Rendering System
 * Google Ads / YouTube Ads inspired design with multiple variants
 * Design System Compliant - Accessibility, Interactivity, UI Consistency
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';
import type { Ad } from '../../types';
import { getBestThumbnailUrl } from '../../utils/thumbnail-utils';
import VideoAdComponent from './VideoAdComponent';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#0FC2C0',
  primaryDark: '#0A8F8D',
  secondary: '#007B55',
  success: '#388E3C',
  warning: '#F9A825',
  error: '#D32F2F',
  text: '#263238',
  textSecondary: '#607D8B',
  textMuted: '#90A4AE',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#FAFAFA',
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  google: '#4285F4',
  youtube: '#FF0000',
};

const FONTS = {
  regular: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium',
  bold: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
};

const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// ============================================================================
// TYPES
// ============================================================================

export type AdVariant = 'standard' | 'featured' | 'banner' | 'compact' | 'native' | 'interstitial' | 'card';

export interface AdComponentProps {
  ad: Ad;
  variant?: AdVariant;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  onAdError?: (error: string) => void;
  onAdDismiss?: (ad: Ad) => void;
  onVideoComplete?: (ad: Ad) => void;
  showDismissButton?: boolean;
  autoPlayVideo?: boolean;
  style?: any;
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Hook to manage thumbnail loading with fallbacks
 */
const useThumbnail = (ad: Ad | null) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

  useEffect(() => {
    if (!ad) {
      setThumbnailUrl(null);
      return;
    }

    const loadThumbnail = async () => {
      // Priority 1: Use existing thumbnailUrl
      if (ad.thumbnailUrl && ad.thumbnailUrl.trim() !== '') {
        setThumbnailUrl(ad.thumbnailUrl);
        return;
      }

      // Priority 2: Use imageUrl as fallback
      if (ad.imageUrl && ad.imageUrl.trim() !== '') {
        setThumbnailUrl(ad.imageUrl);
        return;
      }

      // Priority 3: Generate thumbnail from video
      if (ad.videoUrl && ad.videoUrl.trim() !== '') {
        setIsLoadingThumbnail(true);
        try {
          const generatedThumbnail = await getBestThumbnailUrl(ad);
          setThumbnailUrl(generatedThumbnail);
        } catch (error) {
          console.error('useThumbnail: Error generating thumbnail:', error);
          setThumbnailUrl('https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop');
        } finally {
          setIsLoadingThumbnail(false);
        }
      } else {
        setThumbnailUrl('https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop');
      }
    };

    loadThumbnail();
  }, [ad]);

  return { thumbnailUrl, isLoadingThumbnail };
};

/**
 * Hook for base ad component functionality
 */
const useBaseAdComponent = ({
  ad,
  onAdClick,
  onAdLoad,
  onAdError,
}: {
  ad: Ad | null;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  onAdError?: (error: string) => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handlePress = useCallback(() => {
    if (!ad) return;
    if (ad.targetUrl) {
      Linking.openURL(ad.targetUrl).catch((err) => {
        console.error('Failed to open URL:', err);
      });
    }
    onAdClick?.(ad);
  }, [ad, onAdClick]);

  const handleImageLoad = useCallback(() => {
    setLoading(false);
    onAdLoad?.();
  }, [onAdLoad]);

  const handleImageError = useCallback(() => {
    setLoading(false);
    setError(true);
    onAdError?.('Failed to load advertisement image');
  }, [onAdError]);

  return {
    loading,
    error,
    handlePress,
    handleImageLoad,
    handleImageError,
  };
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Sponsored Badge Component
 */
const SponsoredBadge = memo(({ 
  variant = 'default',
  style,
}: { 
  variant?: 'default' | 'featured' | 'small';
  style?: any;
}) => {
  const isSmall = variant === 'small';
  const isFeatured = variant === 'featured';

  return (
    <LinearGradient
      colors={
        isFeatured
          ? ['rgba(15, 194, 192, 0.95)', 'rgba(15, 194, 192, 0.85)']
          : ['rgba(15, 194, 192, 0.85)', 'rgba(15, 194, 192, 0.75)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.sponsoredBadge,
        isSmall && styles.sponsoredBadgeSmall,
        isFeatured && styles.sponsoredBadgeFeatured,
        style,
      ]}
      accessible
      accessibilityLabel={isFeatured ? 'Featured sponsored ad' : 'Sponsored ad'}
    >
      <Text
        style={[
          styles.sponsoredText,
          isSmall && styles.sponsoredTextSmall,
          isFeatured && styles.sponsoredTextFeatured,
        ]}
      >
        {isFeatured ? 'Featured' : isSmall ? 'Ad' : 'Sponsored'}
      </Text>
    </LinearGradient>
  );
});
SponsoredBadge.displayName = 'SponsoredBadge';

/**
 * Ad Action Button Component
 */
const AdActionButton = memo(({
  label,
  onPress,
  variant = 'default',
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'outline';
  icon?: string;
}) => {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        isPrimary && styles.actionButtonPrimary,
        isOutline && styles.actionButtonOutline,
      ]}
      onPress={onPress}
      accessible
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.actionButtonText,
          isPrimary && styles.actionButtonTextPrimary,
          isOutline && styles.actionButtonTextOutline,
        ]}
      >
        {label}
      </Text>
      {icon && (
        <Ionicons
          name={icon as any}
          size={16}
          color={isPrimary ? '#FFFFFF' : isOutline ? COLORS.primary : COLORS.success}
        />
      )}
    </TouchableOpacity>
  );
});
AdActionButton.displayName = 'AdActionButton';

/**
 * Image Placeholder Component
 */
const ImagePlaceholder = memo(({ 
  size = 'medium',
  text = 'Advertisement',
}: { 
  size?: 'small' | 'medium' | 'large';
  text?: string;
}) => {
  const iconSize = size === 'small' ? 24 : size === 'large' ? 48 : 32;

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB']}
      style={styles.placeholderGradient}
    >
      <Ionicons name="megaphone-outline" size={iconSize} color="#1976D2" />
      <Text style={[styles.placeholderText, size === 'small' && styles.placeholderTextSmall]}>
        {text}
      </Text>
    </LinearGradient>
  );
});
ImagePlaceholder.displayName = 'ImagePlaceholder';

// ============================================================================
// AD VARIANT COMPONENTS
// ============================================================================

/**
 * Standard Ad Component
 */
const StandardAdComponent = ({ 
  ad, 
  onAdClick, 
  onAdLoad, 
  onAdError, 
  style 
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('StandardAd: Invalid ad object');
    return null;
  }

  return (
    <Animated.View 
      style={[styles.standardAdContainer, style]}
      entering={FadeInDown.duration(400)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.adTouchable}
        accessible
        accessibilityLabel={`Standard advertisement: ${ad.title}. ${ad.description}`}
        accessibilityRole="button"
        accessibilityHint="Tap to learn more about this advertisement"
      >
        <View style={styles.standardAdContent}>
          {/* Image Container */}
          <View style={styles.standardAdImageContainer}>
            {(loading || isLoadingThumbnail) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="image-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.errorText}>Image unavailable</Text>
              </View>
            ) : thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.standardAdImage}
                onLoad={handleImageLoad}
                onError={handleImageError}
                resizeMode="cover"
                accessible
                accessibilityLabel="Advertisement image"
              />
            ) : (
              <ImagePlaceholder size="medium" />
            )}

            {ad.sponsored && <SponsoredBadge style={styles.standardSponsoredPosition} />}
          </View>

          {/* Text Content */}
          <View style={styles.standardAdTextContent}>
            <Text style={styles.standardAdTitle} numberOfLines={2}>
              {ad.title}
            </Text>
            <Text style={styles.standardAdDescription} numberOfLines={2}>
              {ad.description}
            </Text>
            <View style={styles.adActionContainer}>
              <Text style={styles.learnMoreText}>Learn More</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.success} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
StandardAdComponent.displayName = 'StandardAd';
export const StandardAd = memo(StandardAdComponent);

/**
 * Featured Ad Component - Premium styling with video support
 */
const FeaturedAdComponent = ({
  ad,
  onAdClick,
  onAdLoad,
  onAdError,
  onVideoComplete,
  autoPlayVideo = false,
  style,
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('FeaturedAd: Invalid ad object');
    return null;
  }

  const hasVideo = ad.videoUrl && ad.videoUrl.trim() !== '';

  // Use VideoAdComponent for video ads
  if (hasVideo) {
    return (
      <Animated.View 
        style={[styles.featuredAdContainer, style]}
        entering={FadeInDown.duration(400)}
      >
        <VideoAdComponent
          ad={ad}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
          onAdError={onAdError}
          onVideoComplete={onVideoComplete}
          autoPlay={autoPlayVideo}
          muted={true}
          loop={true}
          showControls={true}
          showThumbnail={true}
          aspectRatio={16 / 9}
          maxHeight={280}
        />
        
        {/* Featured Ad Content Below Video */}
        <View style={styles.featuredAdContent}>
          <Text style={styles.featuredAdTitle}>{ad.title}</Text>
          <Text style={styles.featuredAdDescription} numberOfLines={2}>
            {ad.description}
          </Text>
          <View style={styles.featuredAdActionContainer}>
            <AdActionButton
              label="Learn More"
              onPress={handlePress}
              variant="primary"
              icon="arrow-forward"
            />
          </View>
        </View>
      </Animated.View>
    );
  }

  // Image-only featured ad
  return (
    <Animated.View 
      style={[styles.featuredAdContainer, style]}
      entering={FadeInDown.duration(400)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.adTouchable}
        accessible
        accessibilityLabel={`Featured advertisement: ${ad.title}. ${ad.description}`}
        accessibilityRole="button"
      >
        {/* Image Container */}
        <View style={styles.featuredAdImageContainer}>
          {(loading || isLoadingThumbnail) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.errorText}>Media unavailable</Text>
            </View>
          ) : thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.featuredAdImage}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
              accessible
              accessibilityLabel="Featured advertisement image"
            />
          ) : (
            <ImagePlaceholder size="large" text="Featured Content" />
          )}

          {/* Shimmer Overlay */}
          <View style={styles.shimmerOverlay} />

          {ad.sponsored && (
            <SponsoredBadge variant="featured" style={styles.featuredSponsoredPosition} />
          )}
        </View>

        {/* Content */}
        <View style={styles.featuredAdContent}>
          <Text style={styles.featuredAdTitle}>{ad.title}</Text>
          <Text style={styles.featuredAdDescription} numberOfLines={2}>
            {ad.description}
          </Text>
          <View style={styles.featuredAdActionContainer}>
            <AdActionButton
              label="Learn More"
              onPress={handlePress}
              variant="primary"
              icon="arrow-forward"
            />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
FeaturedAdComponent.displayName = 'FeaturedAd';
export const FeaturedAd = memo(FeaturedAdComponent);

/**
 * Banner Ad Component - Horizontal strip format
 */
const BannerAdComponent = ({ 
  ad, 
  onAdClick, 
  onAdLoad, 
  onAdError,
  onAdDismiss,
  showDismissButton = false,
  style 
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('BannerAd: Invalid ad object');
    return null;
  }

  return (
    <Animated.View 
      style={[styles.bannerAdContainer, style]}
      entering={FadeInRight.duration(400)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.bannerTouchable}
        accessible
        accessibilityLabel={`Banner advertisement: ${ad.title}`}
        accessibilityRole="button"
      >
        <View style={styles.bannerContent}>
          {/* Image */}
          <View style={styles.bannerImageContainer}>
            {(loading || isLoadingThumbnail) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="image-outline" size={24} color={COLORS.textMuted} />
              </View>
            ) : thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.bannerImage}
                onLoad={handleImageLoad}
                onError={handleImageError}
                resizeMode="cover"
              />
            ) : (
              <ImagePlaceholder size="small" text="Ad" />
            )}
          </View>

          {/* Text Content */}
          <View style={styles.bannerTextContent}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {ad.title}
            </Text>
            <Text style={styles.bannerDescription} numberOfLines={2}>
              {ad.description}
            </Text>

            {ad.sponsored && <SponsoredBadge variant="small" style={styles.bannerSponsoredPosition} />}
          </View>

          {/* Dismiss Button */}
          {showDismissButton && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => onAdDismiss?.(ad)}
              accessible
              accessibilityLabel="Dismiss advertisement"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
BannerAdComponent.displayName = 'BannerAd';
export const BannerAd = memo(BannerAdComponent);

/**
 * Compact Ad Component - Minimal footprint
 */
const CompactAdComponent = ({ 
  ad, 
  onAdClick, 
  onAdLoad, 
  onAdError, 
  style 
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('CompactAd: Invalid ad object');
    return null;
  }

  return (
    <Animated.View 
      style={[styles.compactAdContainer, style]}
      entering={FadeIn.duration(300)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.compactTouchable}
        accessible
        accessibilityLabel={`Compact advertisement: ${ad.title}`}
        accessibilityRole="button"
      >
        <View style={styles.compactContent}>
          {/* Image */}
          <View style={styles.compactImageContainer}>
            {(loading || isLoadingThumbnail) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="image-outline" size={20} color={COLORS.textMuted} />
              </View>
            ) : thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.compactImage}
                onLoad={handleImageLoad}
                onError={handleImageError}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.compactPlaceholder}>
                <Ionicons name="megaphone-outline" size={16} color={COLORS.textMuted} />
              </View>
            )}
          </View>

          {/* Text */}
          <View style={styles.compactTextContent}>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {ad.title}
            </Text>
            {ad.sponsored && <SponsoredBadge variant="small" />}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
CompactAdComponent.displayName = 'CompactAd';
export const CompactAd = memo(CompactAdComponent);

/**
 * Native Ad Component - Blends with content feed
 */
const NativeAdComponent = ({
  ad,
  onAdClick,
  onAdLoad,
  onAdError,
  style,
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('NativeAd: Invalid ad object');
    return null;
  }

  return (
    <Animated.View 
      style={[styles.nativeAdContainer, style]}
      entering={FadeInDown.duration(400)}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handlePress}
        style={styles.adTouchable}
        accessible
        accessibilityLabel={`Native advertisement: ${ad.title}. ${ad.description}`}
        accessibilityRole="button"
      >
        {/* Header */}
        <View style={styles.nativeAdHeader}>
          <View style={styles.nativeAdAdvertiserInfo}>
            <View style={styles.nativeAdAvatar}>
              <Ionicons name="business" size={16} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.nativeAdAdvertiserName}>Advertiser</Text>
              <View style={styles.nativeAdSponsoredRow}>
                <Text style={styles.nativeAdSponsoredText}>Sponsored</Text>
                <Ionicons name="earth" size={12} color={COLORS.textMuted} />
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.nativeAdMenuButton}
            accessible
            accessibilityLabel="Ad options"
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Text style={styles.nativeAdText}>{ad.description}</Text>

        {/* Image */}
        <View style={styles.nativeAdImageContainer}>
          {(loading || isLoadingThumbnail) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
            </View>
          ) : thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.nativeAdImage}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
            />
          ) : (
            <ImagePlaceholder size="large" />
          )}
        </View>

        {/* CTA Section */}
        <View style={styles.nativeAdCta}>
          <View style={styles.nativeAdCtaInfo}>
            <Text style={styles.nativeAdCtaTitle}>{ad.title}</Text>
            <Text style={styles.nativeAdCtaDescription} numberOfLines={1}>
              {ad.targetUrl || 'Learn more'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.nativeAdCtaButton}
            onPress={handlePress}
            accessible
            accessibilityLabel={`Learn more about ${ad.title}`}
            accessibilityRole="button"
          >
            <Text style={styles.nativeAdCtaButtonText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
NativeAdComponent.displayName = 'NativeAd';
export const NativeAd = memo(NativeAdComponent);

/**
 * Card Ad Component - Card-based layout
 */
const CardAdComponent = ({
  ad,
  onAdClick,
  onAdLoad,
  onAdError,
  style,
}: AdComponentProps) => {
  // Call hooks unconditionally at the top
  const validAd = ad?.id && ad?.title ? ad : null;
  const { loading, error, handlePress, handleImageLoad, handleImageError } = useBaseAdComponent({
    ad: validAd,
    onAdClick,
    onAdLoad,
    onAdError,
  });
  const { thumbnailUrl, isLoadingThumbnail } = useThumbnail(validAd);

  // Early return after hooks
  if (!validAd) {
    console.warn('CardAd: Invalid ad object');
    return null;
  }

  return (
    <Animated.View 
      style={[styles.cardAdContainer, style]}
      entering={FadeInDown.duration(400)}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.cardAdTouchable}
        accessible
        accessibilityLabel={`Card advertisement: ${ad.title}`}
        accessibilityRole="button"
      >
        {/* Image */}
        <View style={styles.cardAdImageContainer}>
          {(loading || isLoadingThumbnail) && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="image-outline" size={40} color={COLORS.textMuted} />
            </View>
          ) : thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.cardAdImage}
              onLoad={handleImageLoad}
              onError={handleImageError}
              resizeMode="cover"
            />
          ) : (
            <ImagePlaceholder size="medium" />
          )}

          {ad.sponsored && <SponsoredBadge style={styles.cardSponsoredPosition} />}
        </View>

        {/* Content */}
        <View style={styles.cardAdContent}>
          <Text style={styles.cardAdTitle} numberOfLines={2}>
            {ad.title}
          </Text>
          <Text style={styles.cardAdDescription} numberOfLines={2}>
            {ad.description}
          </Text>
          <AdActionButton
            label="Shop Now"
            onPress={handlePress}
            variant="outline"
            icon="arrow-forward"
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};
CardAdComponent.displayName = 'CardAd';
export const CardAd = memo(CardAdComponent);

// ============================================================================
// SMART AD SELECTOR
// ============================================================================

/**
 * SmartAd - Intelligent ad type selector based on ad data and position
 */
const SmartAdComponent = ({
  ad,
  variant = 'standard',
  onAdClick,
  onAdLoad,
  onAdError,
  onAdDismiss,
  onVideoComplete,
  showDismissButton,
  autoPlayVideo,
  style,
}: AdComponentProps & { variant?: AdVariant }) => {
  if (!ad || typeof ad !== 'object') {
    console.warn('SmartAd: Invalid ad object');
    return null;
  }

  // Determine the best ad type
  const determineAdType = (): AdVariant => {
    // If ad has a specific type, map it
    if (ad.type) {
      const typeMap: Record<string, AdVariant> = {
        regular: 'standard',
        featured: 'featured',
        banner: 'banner',
        compact: 'compact',
      };
      return typeMap[ad.type] || variant;
    }

    // If ad has video, prefer featured for better experience
    if (ad.videoUrl && ad.videoUrl.trim() !== '') {
      return 'featured';
    }

    return variant;
  };

  const adType = determineAdType();
  const commonProps = {
    ad,
    onAdClick,
    onAdLoad,
    onAdError,
    onAdDismiss,
    onVideoComplete,
    showDismissButton,
    autoPlayVideo,
    style,
  };

  switch (adType) {
    case 'featured':
      return <FeaturedAd {...commonProps} />;
    case 'banner':
      return <BannerAd {...commonProps} />;
    case 'compact':
      return <CompactAd {...commonProps} />;
    case 'native':
      return <NativeAd {...commonProps} />;
    case 'card':
      return <CardAd {...commonProps} />;
    default:
      return <StandardAd {...commonProps} />;
  }
};
SmartAdComponent.displayName = 'SmartAd';
export const SmartAd = memo(SmartAdComponent);

// ============================================================================
// MAIN EXPORT
// ============================================================================

const AdComponent = SmartAd;

export default AdComponent;

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Common
  adTouchable: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  errorText: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontFamily: FONTS.regular,
    fontSize: 12,
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#1976D2',
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  placeholderTextSmall: {
    fontSize: 10,
    marginTop: 4,
  },

  // Sponsored Badge
  sponsoredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sponsoredBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sponsoredBadgeFeatured: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  sponsoredText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sponsoredTextSmall: {
    fontSize: 8,
  },
  sponsoredTextFeatured: {
    fontSize: 11,
  },

  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonOutline: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: COLORS.success,
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  actionButtonTextOutline: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },

  // Standard Ad
  standardAdContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  standardAdContent: {
    flexDirection: 'row',
    height: 120,
  },
  standardAdImageContainer: {
    width: 120,
    height: '100%',
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  standardAdImage: {
    width: '100%',
    height: '100%',
  },
  standardSponsoredPosition: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  standardAdTextContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  standardAdTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  standardAdDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  adActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  learnMoreText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.success,
    marginRight: 4,
  },

  // Featured Ad
  featuredAdContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
  featuredAdImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  featuredAdImage: {
    width: '100%',
    height: '100%',
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(200, 230, 201, 0.05)',
  },
  featuredSponsoredPosition: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  featuredAdContent: {
    padding: 16,
  },
  featuredAdTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  featuredAdDescription: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 21,
  },
  featuredAdActionContainer: {
    alignItems: 'flex-start',
  },

  // Banner Ad
  bannerAdContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 80,
    ...SHADOWS.small,
  },
  bannerTouchable: {
    flex: 1,
  },
  bannerContent: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  bannerImageContainer: {
    width: 80,
    height: '100%',
    backgroundColor: COLORS.surface,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerTextContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  bannerDescription: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  bannerSponsoredPosition: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  dismissButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Compact Ad
  compactAdContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 56,
    ...SHADOWS.small,
  },
  compactTouchable: {
    flex: 1,
  },
  compactContent: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
  },
  compactImageContainer: {
    width: 56,
    height: '100%',
    backgroundColor: COLORS.surface,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  compactTextContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  compactTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },

  // Native Ad (Facebook/Instagram style)
  nativeAdContainer: {
    backgroundColor: COLORS.background,
    marginVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
  },
  nativeAdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  nativeAdAdvertiserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nativeAdAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeAdAdvertiserName: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  nativeAdSponsoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nativeAdSponsoredText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  nativeAdMenuButton: {
    padding: 8,
  },
  nativeAdText: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 20,
  },
  nativeAdImageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: COLORS.surface,
  },
  nativeAdImage: {
    width: '100%',
    height: '100%',
  },
  nativeAdCta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surfaceElevated,
  },
  nativeAdCtaInfo: {
    flex: 1,
    marginRight: 12,
  },
  nativeAdCtaTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  nativeAdCtaDescription: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  nativeAdCtaButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  nativeAdCtaButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 13,
  },

  // Card Ad
  cardAdContainer: {
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  cardAdTouchable: {
    flex: 1,
  },
  cardAdImageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  cardAdImage: {
    width: '100%',
    height: '100%',
  },
  cardSponsoredPosition: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  cardAdContent: {
    padding: 12,
  },
  cardAdTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  cardAdDescription: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
});
