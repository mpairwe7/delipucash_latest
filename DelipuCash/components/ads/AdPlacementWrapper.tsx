/**
 * AdPlacementWrapper - Industry Standard Ad Placement Container
 * 
 * Provides consistent ad placement across screens following best practices:
 * - Google/YouTube ad placement guidelines
 * - IAB (Interactive Advertising Bureau) standards
 * - Non-intrusive user experience
 * - Smooth transitions and animations
 * 
 * Placement Types:
 * - inline: Within content feed (Native ads)
 * - banner: Horizontal strip (top/bottom)
 * - interstitial: Full screen between actions
 * - sticky: Fixed position (top/bottom of screen)
 * - between-content: Placed between content sections
 */

import React, { memo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
  TouchableOpacity,
  Text,
  Animated,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedLib, {
  FadeIn,
  SlideInUp,
  SlideOutDown,
  SlideInRight,
  SlideInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Ad } from '../../types';
import { BannerAd, NativeAd, FeaturedAd, CompactAd, SmartAd } from './AdComponent';
import VideoAdComponent from './VideoAdComponent';

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  overlay: 'rgba(0, 0, 0, 0.85)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
  background: '#FFFFFF',
  text: '#263238',
  textMuted: '#90A4AE',
  primary: '#0FC2C0',
  border: '#E0E0E0',
};

const FONTS = {
  regular: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium',
  bold: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
};

// ============================================================================
// TYPES
// ============================================================================

export type AdPlacementType = 
  | 'inline'           // Within content feed
  | 'banner-top'       // Fixed top banner
  | 'banner-bottom'    // Fixed bottom banner
  | 'between-content'  // Between content sections
  | 'interstitial'     // Full screen overlay
  | 'rewarded'         // Full screen with reward
  | 'sticky-bottom'    // Sticky at bottom
  | 'sticky-top'       // Sticky at top
  | 'in-feed'          // Inline in feed (like Instagram)
  | 'post-action'      // After user action
  | 'pre-roll'         // Before video content
  | 'mid-roll'         // During video content
  | 'end-card';        // End of content

export interface AdPlacementWrapperProps {
  ad: Ad | null;
  ads?: Ad[];
  placement: AdPlacementType;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  onAdError?: (error: string) => void;
  onAdDismiss?: (ad: Ad) => void;
  onAdComplete?: (ad: Ad) => void;
  onRewardEarned?: (ad: Ad, reward: { type: string; amount: number }) => void;
  visible?: boolean;
  onClose?: () => void;
  autoHideAfter?: number; // milliseconds
  showDismissButton?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export interface InterstitialAdProps {
  ad: Ad;
  visible: boolean;
  onClose: () => void;
  onAdClick?: (ad: Ad) => void;
  onAdComplete?: (ad: Ad) => void;
  skipAfterSeconds?: number;
  showCloseButton?: boolean;
}

export interface StickyBannerProps {
  ad: Ad;
  position: 'top' | 'bottom';
  onAdClick?: (ad: Ad) => void;
  onDismiss?: (ad: Ad) => void;
  autoHideAfter?: number;
  showDismissButton?: boolean;
  style?: ViewStyle;
}

export interface InFeedAdProps {
  ad: Ad;
  index?: number;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  style?: ViewStyle;
}

// ============================================================================
// INTERSTITIAL AD COMPONENT (Full Screen)
// ============================================================================

const InterstitialAdComponent: React.FC<InterstitialAdProps> = memo(({
  ad,
  visible,
  onClose,
  onAdClick,
  onAdComplete,
  skipAfterSeconds = 5,
  showCloseButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const [canSkip, setCanSkip] = useState(false);
  const [countdown, setCountdown] = useState(skipAfterSeconds);
  const hasVideo = ad.videoUrl && ad.videoUrl.trim() !== '';

  useEffect(() => {
    if (!visible) {
      setCanSkip(false);
      setCountdown(skipAfterSeconds);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, skipAfterSeconds]);

  const handleClose = useCallback(() => {
    if (canSkip || !hasVideo) {
      onClose();
    }
  }, [canSkip, hasVideo, onClose]);

  const handleVideoComplete = useCallback(() => {
    setCanSkip(true);
    onAdComplete?.(ad);
  }, [ad, onAdComplete]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.interstitialOverlay}>
        <AnimatedLib.View
          style={styles.interstitialContainer}
          entering={SlideInUp.duration(400).springify()}
          exiting={SlideOutDown.duration(300)}
        >
          {/* Ad Content */}
          <View style={[styles.interstitialContent, { paddingTop: insets.top }]}>
            {hasVideo ? (
              <VideoAdComponent
                ad={ad}
                onAdClick={onAdClick}
                onVideoComplete={handleVideoComplete}
                autoPlay={true}
                muted={false}
                showControls={true}
                showSkipButton={true}
                skipAfterSeconds={skipAfterSeconds}
                aspectRatio={9 / 16}
                maxHeight={SCREEN_HEIGHT * 0.7}
                variant="fullscreen"
              />
            ) : (
              <FeaturedAd
                ad={ad}
                onAdClick={onAdClick}
                style={styles.interstitialFeaturedAd}
              />
            )}
          </View>

          {/* Close/Skip Button */}
          {showCloseButton && (
            <TouchableOpacity
              style={[
                styles.interstitialCloseButton,
                { top: insets.top + 16 },
                !canSkip && hasVideo && styles.interstitialCloseButtonDisabled,
              ]}
              onPress={handleClose}
              disabled={!canSkip && !!hasVideo}
              accessible
              accessibilityLabel={canSkip ? 'Close advertisement' : `Skip in ${countdown} seconds`}
              accessibilityRole="button"
            >
              {canSkip || !hasVideo ? (
                <Ionicons name="close" size={24} color="#FFFFFF" />
              ) : (
                <Text style={styles.countdownText}>{countdown}</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Ad Label */}
          <View style={[styles.interstitialAdLabel, { top: insets.top + 16 }]}>
            <Text style={styles.interstitialAdLabelText}>AD</Text>
          </View>
        </AnimatedLib.View>
      </View>
    </Modal>
  );
});
InterstitialAdComponent.displayName = 'InterstitialAd';

export const InterstitialAd = InterstitialAdComponent;

// ============================================================================
// STICKY BANNER COMPONENT
// ============================================================================

const StickyBannerComponent: React.FC<StickyBannerProps> = memo(({
  ad,
  position,
  onAdClick,
  onDismiss,
  autoHideAfter,
  showDismissButton = true,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.(ad);
    });
  }, [ad, onDismiss, slideAnim]);

  useEffect(() => {
    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    // Auto-hide logic
    if (autoHideAfter) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideAfter);
      return () => clearTimeout(timer);
    }
  }, [autoHideAfter, handleDismiss, slideAnim]);

  if (!isVisible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [position === 'top' ? -100 : 100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.stickyBanner,
        position === 'top' 
          ? { top: 0, paddingTop: insets.top } 
          : { bottom: 0, paddingBottom: insets.bottom },
        { transform: [{ translateY }] },
        style,
      ]}
    >
      <BannerAd
        ad={ad}
        onAdClick={onAdClick}
        onAdDismiss={onDismiss}
        showDismissButton={showDismissButton}
        style={styles.stickyBannerAd}
      />
      {showDismissButton && (
        <TouchableOpacity
          style={styles.stickyDismissButton}
          onPress={handleDismiss}
          accessible
          accessibilityLabel="Dismiss banner"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});
StickyBannerComponent.displayName = 'StickyBanner';

export const StickyBanner = StickyBannerComponent;

// ============================================================================
// IN-FEED AD COMPONENT
// ============================================================================

const InFeedAdComponent: React.FC<InFeedAdProps> = memo(({
  ad,
  index = 0,
  onAdClick,
  onAdLoad,
  style,
}) => {
  // Delay animation based on index for staggered effect
  const delay = index * 100;

  return (
    <AnimatedLib.View
      style={[styles.inFeedContainer, style]}
      entering={FadeIn.delay(delay).duration(400)}
    >
      <NativeAd
        ad={ad}
        onAdClick={onAdClick}
        onAdLoad={onAdLoad}
        style={styles.inFeedAd}
      />
    </AnimatedLib.View>
  );
});
InFeedAdComponent.displayName = 'InFeedAd';

export const InFeedAd = InFeedAdComponent;

// ============================================================================
// BETWEEN CONTENT AD COMPONENT
// ============================================================================

interface BetweenContentAdProps {
  ad: Ad;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  variant?: 'banner' | 'native' | 'compact' | 'featured';
  style?: ViewStyle;
}

const BetweenContentAdComponent: React.FC<BetweenContentAdProps> = memo(({
  ad,
  onAdClick,
  onAdLoad,
  variant = 'banner',
  style,
}) => {
  const AdComponent = {
    banner: BannerAd,
    native: NativeAd,
    compact: CompactAd,
    featured: FeaturedAd,
  }[variant];

  return (
    <AnimatedLib.View
      style={[styles.betweenContentContainer, style]}
      entering={SlideInRight.duration(400)}
    >
      <View style={styles.betweenContentDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Sponsored</Text>
        <View style={styles.dividerLine} />
      </View>
      <AdComponent
        ad={ad}
        onAdClick={onAdClick}
        onAdLoad={onAdLoad}
        style={styles.betweenContentAd}
      />
    </AnimatedLib.View>
  );
});
BetweenContentAdComponent.displayName = 'BetweenContentAd';

export const BetweenContentAd = BetweenContentAdComponent;

// ============================================================================
// AD CAROUSEL COMPONENT (Multiple Ads)
// ============================================================================

interface AdCarouselProps {
  ads: Ad[];
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  autoScrollInterval?: number;
  style?: ViewStyle;
}

const AdCarouselComponent: React.FC<AdCarouselProps> = memo(({
  ads,
  onAdClick,
  onAdLoad,
  autoScrollInterval = 5000,
  style,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex((prev) => (prev + 1) % ads.length);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, autoScrollInterval);

    return () => clearInterval(interval);
  }, [ads.length, autoScrollInterval, fadeAnim]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <View style={[styles.carouselContainer, style]}>
      <Animated.View style={[styles.carouselContent, { opacity: fadeAnim }]}>
        <FeaturedAd
          ad={currentAd}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
        />
      </Animated.View>
      
      {/* Pagination Dots */}
      {ads.length > 1 && (
        <View style={styles.carouselPagination}>
          {ads.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});
AdCarouselComponent.displayName = 'AdCarousel';

export const AdCarousel = AdCarouselComponent;

// ============================================================================
// MAIN AD PLACEMENT WRAPPER
// ============================================================================

const AdPlacementWrapperComponent: React.FC<AdPlacementWrapperProps> = ({
  ad,
  ads,
  placement,
  onAdClick,
  onAdLoad,
  onAdError,
  onAdDismiss,
  onAdComplete,
  onRewardEarned,
  visible = true,
  onClose,
  autoHideAfter,
  showDismissButton = true,
  style,
  children,
}) => {
  if (!ad && (!ads || ads.length === 0)) return null;
  if (!visible) return null;

  // Single ad rendering logic
  const singleAd = ad || (ads && ads[0]);

  switch (placement) {
    case 'interstitial':
    case 'rewarded':
      return (
        <InterstitialAd
          ad={singleAd!}
          visible={visible}
          onClose={onClose || (() => {})}
          onAdClick={onAdClick}
          onAdComplete={onAdComplete}
          skipAfterSeconds={placement === 'rewarded' ? 15 : 5}
          showCloseButton={showDismissButton}
        />
      );

    case 'sticky-top':
      return (
        <StickyBanner
          ad={singleAd!}
          position="top"
          onAdClick={onAdClick}
          onDismiss={onAdDismiss}
          autoHideAfter={autoHideAfter}
          showDismissButton={showDismissButton}
          style={style}
        />
      );

    case 'sticky-bottom':
      return (
        <StickyBanner
          ad={singleAd!}
          position="bottom"
          onAdClick={onAdClick}
          onDismiss={onAdDismiss}
          autoHideAfter={autoHideAfter}
          showDismissButton={showDismissButton}
          style={style}
        />
      );

    case 'banner-top':
    case 'banner-bottom':
      return (
        <AnimatedLib.View
          style={[styles.bannerPlacement, style]}
          entering={FadeIn.duration(300)}
        >
          <BannerAd
            ad={singleAd!}
            onAdClick={onAdClick}
            onAdLoad={onAdLoad}
            onAdDismiss={onAdDismiss}
            showDismissButton={showDismissButton}
          />
        </AnimatedLib.View>
      );

    case 'in-feed':
    case 'inline':
      return (
        <InFeedAd
          ad={singleAd!}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
          style={style}
        />
      );

    case 'between-content':
      return (
        <BetweenContentAd
          ad={singleAd!}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
          variant="native"
          style={style}
        />
      );

    case 'pre-roll':
    case 'mid-roll':
      return singleAd?.videoUrl ? (
        <AnimatedLib.View
          style={[styles.videoAdPlacement, style]}
          entering={FadeIn.duration(400)}
        >
          <VideoAdComponent
            ad={singleAd}
            onAdClick={onAdClick}
            onVideoComplete={onAdComplete}
            autoPlay={true}
            muted={false}
            showControls={true}
            showSkipButton={placement === 'pre-roll'}
            skipAfterSeconds={5}
          />
        </AnimatedLib.View>
      ) : null;

    case 'end-card':
      return (
        <AnimatedLib.View
          style={[styles.endCardPlacement, style]}
          entering={SlideInDown.duration(400)}
        >
          <FeaturedAd
            ad={singleAd!}
            onAdClick={onAdClick}
            onAdLoad={onAdLoad}
          />
        </AnimatedLib.View>
      );

    case 'post-action':
      return (
        <AnimatedLib.View
          style={[styles.postActionPlacement, style]}
          entering={FadeIn.delay(500).duration(400)}
        >
          <NativeAd
            ad={singleAd!}
            onAdClick={onAdClick}
            onAdLoad={onAdLoad}
          />
        </AnimatedLib.View>
      );

    default:
      return (
        <SmartAd
          ad={singleAd!}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
          onAdError={onAdError}
          style={style}
        />
      );
  }
};

AdPlacementWrapperComponent.displayName = 'AdPlacementWrapper';

export const AdPlacementWrapper = memo(AdPlacementWrapperComponent);

export default AdPlacementWrapper;

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Interstitial
  interstitialOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interstitialContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.background,
  },
  interstitialContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interstitialFeaturedAd: {
    width: SCREEN_WIDTH - 32,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  interstitialCloseButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  interstitialCloseButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONTS.bold,
  },
  interstitialAdLabel: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  interstitialAdLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.bold,
    letterSpacing: 1,
  },

  // Sticky Banner
  stickyBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  stickyBannerAd: {
    marginHorizontal: 0,
  },
  stickyDismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },

  // In-Feed
  inFeedContainer: {
    marginVertical: 12,
    marginHorizontal: 16,
  },
  inFeedAd: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Between Content
  betweenContentContainer: {
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  betweenContentDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  betweenContentAd: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Carousel
  carouselContainer: {
    marginVertical: 16,
  },
  carouselContent: {
    width: '100%',
  },
  carouselPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  paginationDotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },

  // Placement Containers
  bannerPlacement: {
    marginVertical: 12,
    marginHorizontal: 16,
  },
  videoAdPlacement: {
    marginVertical: 16,
  },
  endCardPlacement: {
    marginTop: 24,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  postActionPlacement: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
});
