/**
 * AdPlacementWrapper - Industry Standard Ad Placement Container
 * 
 * Provides consistent ad placement across screens following best practices:
 * - Google/YouTube ad placement guidelines
 * - IAB (Interactive Advertising Bureau) standards
 * - Non-intrusive user experience
 * - Smooth transitions and animations
 * - Viewability tracking (IAB MRC standards)
 * - Frequency capping integration
 * 
 * Placement Types:
 * - inline: Within content feed (Native ads)
 * - banner: Horizontal strip (top/bottom)
 * - interstitial: Full screen between actions
 * - sticky: Fixed position (top/bottom of screen)
 * - between-content: Placed between content sections
 * 
 * Enhanced Features (2024-2025):
 * - IAB viewability tracking (50% visible for 1 second)
 * - Automatic impression recording
 * - Smart placement with frequency capping
 * - Accessibility improvements (WCAG 2.2 AA)
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
  LayoutChangeEvent,
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
import { AdFrequencyManager } from '../../services/adFrequencyManager';
import { useSmartAdPlacement, AdContextType } from '../../services/useSmartAdPlacement';

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
  /** Context type for smart placement */
  contextType?: AdContextType;
  /** Position in feed (for frequency capping) */
  feedPosition?: number;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  onAdError?: (error: string) => void;
  onAdDismiss?: (ad: Ad) => void;
  onAdComplete?: (ad: Ad) => void;
  onRewardEarned?: (ad: Ad, reward: { type: string; amount: number }) => void;
  /** Viewability callback (IAB standard met) */
  onViewable?: (ad: Ad) => void;
  /** Impression recorded callback */
  onImpression?: (ad: Ad) => void;
  visible?: boolean;
  onClose?: () => void;
  autoHideAfter?: number; // milliseconds
  showDismissButton?: boolean;
  /** Enable viewability tracking */
  trackViewability?: boolean;
  /** Skip frequency cap check */
  bypassFrequencyCap?: boolean;
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
  onViewable?: (ad: Ad) => void;
  onImpression?: (ad: Ad) => void;
  trackViewability?: boolean;
  style?: ViewStyle;
}

// ============================================================================
// VIEWABILITY TRACKING HOOK
// ============================================================================

/**
 * Hook for IAB MRC viewability tracking
 * - Display ads: 50% visible for 1 continuous second
 * - Video ads: 50% visible for 2 continuous seconds
 *
 * Performance: uses refs for tracking state to avoid re-renders during scroll.
 * Only triggers a single state update when viewability is confirmed.
 */
function useViewabilityTracking(
  adId: string,
  enabled: boolean = true,
  onViewable?: () => void,
  isVideo: boolean = false
) {
  const [isViewable, setIsViewable] = useState(false);
  // Use ref for viewability percent — updated on every scroll frame, shouldn't re-render
  const viewabilityPercentRef = useRef(0);
  const visibleStartTimeRef = useRef<number>(0);
  const viewabilityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordedViewableRef = useRef(false);
  // Stable ref for callback to avoid stale closures in interval
  const onViewableRef = useRef(onViewable);
  onViewableRef.current = onViewable;

  const viewabilityThreshold = isVideo ? 2000 : 1000; // IAB standard

  const startTracking = useCallback(() => {
    if (!enabled) return;

    visibleStartTimeRef.current = Date.now();
    AdFrequencyManager.startViewabilityTracking(adId);

    viewabilityIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - visibleStartTimeRef.current;

      // Read from ref — always current, no stale closure
      if (elapsed >= viewabilityThreshold && viewabilityPercentRef.current >= 50 && !hasRecordedViewableRef.current) {
        setIsViewable(true);
        hasRecordedViewableRef.current = true;
        onViewableRef.current?.();

        // Stop tracking after viewability confirmed
        if (viewabilityIntervalRef.current) {
          clearInterval(viewabilityIntervalRef.current);
          viewabilityIntervalRef.current = null;
        }
      }
    }, 500); // 500ms granularity sufficient for 1s/2s IAB thresholds
  }, [adId, enabled, viewabilityThreshold]);

  const stopTracking = useCallback(() => {
    if (viewabilityIntervalRef.current) {
      clearInterval(viewabilityIntervalRef.current);
      viewabilityIntervalRef.current = null;
    }
    AdFrequencyManager.stopViewabilityTracking(adId);
  }, [adId]);

  const updateVisibility = useCallback((percent: number) => {
    viewabilityPercentRef.current = percent;

    // Only update frequency manager if tracking is enabled
    if (enabled) {
      AdFrequencyManager.updateViewability(adId, percent >= 50, percent);
    }

    if (percent >= 50 && visibleStartTimeRef.current === 0) {
      startTracking();
    } else if (percent < 50 && visibleStartTimeRef.current > 0) {
      stopTracking();
      visibleStartTimeRef.current = 0;
    }
  }, [adId, enabled, startTracking, stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    isViewable,
    viewabilityPercent: viewabilityPercentRef.current,
    updateVisibility,
    startTracking,
    stopTracking,
  };
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
  onViewable,
  onImpression,
  trackViewability = true,
  style,
}) => {
  // Limit stagger delay to prevent very long delays for deep items
  const delay = Math.min(index * 100, 500);
  const impressionRecordedRef = useRef(false);
  const containerRef = useRef<View>(null);

  // Stable viewability callback — avoid anonymous closure that breaks memo
  const handleViewable = useCallback(() => {
    onViewable?.(ad);
    // Record impression when viewable (IAB standard)
    if (!impressionRecordedRef.current) {
      impressionRecordedRef.current = true;
      AdFrequencyManager.recordImpression(ad.id, 'feed');
      onImpression?.(ad);
    }
  }, [ad, onViewable, onImpression]);

  // Viewability tracking
  const { updateVisibility } = useViewabilityTracking(
    ad.id,
    trackViewability,
    handleViewable
  );

  // Handle layout for viewability calculation
  // Instead of assuming 100% visible immediately, measure actual position
  // relative to viewport. The IAB timer in useViewabilityTracking ensures
  // the impression only fires after 1s of continuous 50%+ visibility.
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (containerRef.current) {
      containerRef.current.measureInWindow((_x, y, _w, h) => {
        if (y === undefined || h === undefined) return;
        const screenHeight = Dimensions.get('window').height;
        const visibleTop = Math.max(0, y);
        const visibleBottom = Math.min(screenHeight, y + (h || height));
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const percent = (h || height) > 0 ? (visibleHeight / (h || height)) * 100 : 0;
        updateVisibility(Math.round(percent));
      });
    }
  }, [updateVisibility]);

  return (
    <AnimatedLib.View
      style={[styles.inFeedContainer, style]}
      entering={FadeIn.delay(delay).duration(400)}
    >
      <View
        ref={containerRef}
        onLayout={handleLayout}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Sponsored content: ${ad.title || 'Advertisement'}. Tap to learn more.`}
      >
        <NativeAd
          ad={ad}
          onAdClick={onAdClick}
          onAdLoad={onAdLoad}
          style={styles.inFeedAd}
        />
      </View>
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
  contextType = 'home',
  feedPosition = 0,
  onAdClick,
  onAdLoad,
  onAdError,
  onAdDismiss,
  onAdComplete,
  onRewardEarned,
  onViewable,
  onImpression,
  visible = true,
  onClose,
  autoHideAfter,
  showDismissButton = true,
  trackViewability = true,
  bypassFrequencyCap = false,
  style,
  children,
}) => {
  // Map placement type to AdFrequencyManager type
  const frequencyPlacementType = placement === 'in-feed' || placement === 'inline'
    ? 'feed'
    : placement === 'between-content'
      ? 'between_content'
      : placement === 'interstitial' || placement === 'rewarded'
        ? 'interstitial'
        : placement === 'banner-top' || placement === 'banner-bottom'
          ? 'banner'
          : placement === 'pre-roll' || placement === 'mid-roll'
            ? 'video'
            : 'native';

  // Use smart ad placement hook
  const smartPlacement = useSmartAdPlacement({
    placementType: frequencyPlacementType as any,
    contextType,
    position: feedPosition,
    adId: ad?.id || ads?.[0]?.id || 'unknown',
    forceShow: bypassFrequencyCap,
    trackViewability,
  });

  // Extract stable method refs so useCallback deps don't cascade re-renders
  const { trackClick, trackImpression } = smartPlacement;

  // Handle ad click with tracking
  const handleAdClick = useCallback((clickedAd: Ad) => {
    trackClick();
    onAdClick?.(clickedAd);
  }, [trackClick, onAdClick]);

  // Handle viewable callback
  const handleViewable = useCallback((viewableAd: Ad) => {
    trackImpression();
    onViewable?.(viewableAd);
  }, [trackImpression, onViewable]);

  if (!ad && (!ads || ads.length === 0)) return null;
  if (!visible) return null;

  // Wait for eligibility check to complete
  if (!smartPlacement.isReady) return null;

  // Check frequency cap (unless bypassed)
  if (!bypassFrequencyCap && !smartPlacement.canShowAd) {
    // Log blocked reason for analytics (only if not initializing)
    if (smartPlacement.blockedReason !== 'initializing') {
      console.log(`[AdPlacement] Blocked: ${smartPlacement.blockedReason} for ad ${ad?.id}`);
    }
    return null;
  }

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
          onAdClick={handleAdClick}
          onAdLoad={onAdLoad}
          onViewable={handleViewable}
          onImpression={onImpression}
          trackViewability={trackViewability}
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
