/**
 * SkippableVideoAd - YouTube/TikTok Style Skippable Video Advertisement
 * 
 * Industry-standard video ad with skip-after-N-seconds functionality,
 * progress tracking, mute controls, and accessibility support.
 * 
 * Inspired by:
 * - YouTube skippable in-stream ads (skip after 5s)
 * - TikTok sponsored video content
 * - Instagram Reels sponsored videos
 * 
 * Features:
 * - Skip countdown timer (customizable 5-15 seconds)
 * - Smooth progress bar animation
 * - Mute/unmute toggle
 * - Fullscreen toggle
 * - CTA overlay (Learn More, Shop Now, etc.)
 * - Viewability tracking (IAB standards)
 * - Accessibility (VoiceOver/TalkBack)
 * - Error states with retry
 * - Loading skeleton
 * 
 * @example
 * ```tsx
 * <SkippableVideoAd
 *   ad={videoAd}
 *   skipAfterSeconds={5}
 *   onSkip={handleSkip}
 *   onComplete={handleComplete}
 *   onCTAPress={handleCTA}
 * />
 * ```
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Image,
  AccessibilityInfo,
  Linking,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideInRight,
} from 'react-native-reanimated';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipForward,
  RefreshCw,
  ExternalLink,
  Clock,
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
import { AdFrequencyManager } from '@/services/adFrequencyManager';

// ============================================================================
// TYPES
// ============================================================================

export interface SkippableVideoAdProps {
  /** Ad data */
  ad: Ad;
  /** Seconds before skip is available (default: 5) */
  skipAfterSeconds?: number;
  /** Auto-play video (default: true) */
  autoPlay?: boolean;
  /** Start muted (default: true for mobile UX) */
  muted?: boolean;
  /** Loop video (default: false) */
  loop?: boolean;
  /** Aspect ratio (default: 16/9) */
  aspectRatio?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Variant style */
  variant?: 'default' | 'inline' | 'fullscreen' | 'story';
  /** Show CTA overlay */
  showCTA?: boolean;
  /** Skip callback */
  onSkip?: (ad: Ad, watchedSeconds: number) => void;
  /** Complete callback (watched 100%) */
  onComplete?: (ad: Ad) => void;
  /** CTA press callback */
  onCTAPress?: (ad: Ad) => void;
  /** Error callback */
  onError?: (ad: Ad, error: string) => void;
  /** Progress callback */
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  /** Load callback */
  onLoad?: (ad: Ad) => void;
  /** Custom style */
  style?: any;
  /** Test ID */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CTA_CONFIG: Record<string, { label: string; icon: string }> = {
  learn_more: { label: 'Learn More', icon: 'info' },
  shop_now: { label: 'Shop Now', icon: 'cart' },
  sign_up: { label: 'Sign Up', icon: 'user-plus' },
  download: { label: 'Download', icon: 'download' },
  get_offer: { label: 'Get Offer', icon: 'gift' },
  book_now: { label: 'Book Now', icon: 'calendar' },
  apply_now: { label: 'Apply Now', icon: 'check' },
  subscribe: { label: 'Subscribe', icon: 'bell' },
  watch_video: { label: 'Watch More', icon: 'play' },
};

// ============================================================================
// COMPONENT
// ============================================================================

const SkippableVideoAdComponent: React.FC<SkippableVideoAdProps> = ({
  ad,
  skipAfterSeconds = 5,
  autoPlay = true,
  muted: initialMuted = true,
  loop = false,
  aspectRatio = 16 / 9,
  maxHeight = 300,
  variant = 'default',
  showCTA = true,
  onSkip,
  onComplete,
  onCTAPress,
  onError,
  onProgress,
  onLoad,
  style,
  testID,
}) => {
  const { colors } = useTheme();

  // ========== STATE ==========
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(skipAfterSeconds);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // ========== REFS ==========
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewabilityStartRef = useRef<number>(0);

  // ========== ANIMATIONS ==========
  const progressWidth = useSharedValue(0);
  const skipButtonScale = useSharedValue(1);
  const ctaSlide = useSharedValue(0);

  // ========== VIDEO PLAYER ==========
  const videoUrl = ad.videoUrl || '';
  const thumbnailUrl = ad.thumbnailUrl || ad.imageUrl || '';
  const ctaConfig = CTA_CONFIG[ad.callToAction || 'learn_more'] || CTA_CONFIG.learn_more;

  const player = useVideoPlayer(videoUrl, (p) => {
    try {
      p.loop = loop;
      p.muted = isMuted;
      if (autoPlay && !showThumbnail) {
        p.play();
      }
    } catch (error) {
      console.warn('[SkippableVideoAd] Error configuring player:', error);
    }
  });

  // ========== EFFECTS ==========

  // Screen reader check
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );
    return () => subscription.remove();
  }, []);

  // Start viewability tracking
  useEffect(() => {
    viewabilityStartRef.current = Date.now();
    AdFrequencyManager.startViewabilityTracking(ad.id);
    onLoad?.(ad);

    return () => {
      AdFrequencyManager.stopViewabilityTracking(ad.id);
    };
  }, [ad.id, onLoad, ad]);

  // Player status subscription
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setIsBuffering(false);
        setHasError(false);
        setDuration(player.duration || 0);
        
        // Fade out thumbnail
        setTimeout(() => setShowThumbnail(false), 300);
      } else if (event.status === 'loading') {
        setIsBuffering(true);
      } else if (event.status === 'error') {
        setHasError(true);
        setIsBuffering(false);
        onError?.(ad, 'Failed to load video');
      }
    });

    const playingSub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player, ad, onError]);

  // Progress tracking
  useEffect(() => {
    if (!isPlaying || !player) return;

    progressIntervalRef.current = setInterval(() => {
      try {
        const current = player.currentTime || 0;
        const total = player.duration || 0;

        setCurrentTime(current);
        setDuration(total);

        if (total > 0) {
          const progress = (current / total) * 100;
          progressWidth.value = withTiming(progress, { duration: 100 });
          onProgress?.(progress, current, total);

          // Update viewability
          AdFrequencyManager.updateViewability(ad.id, true, 100);

          // Check for completion
          if (current >= total - 0.5 && !hasCompleted) {
            setHasCompleted(true);
            onComplete?.(ad);
          }
        }
      } catch {
        // Player may be released
      }
    }, 250);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, player, ad, onProgress, onComplete, hasCompleted, progressWidth]);

  // Skip countdown
  useEffect(() => {
    if (!isPlaying || canSkip) return;

    skipIntervalRef.current = setInterval(() => {
      setSkipCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          skipButtonScale.value = withSpring(1.1, { damping: 8 }, () => {
            skipButtonScale.value = withSpring(1);
          });
          if (skipIntervalRef.current) {
            clearInterval(skipIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (skipIntervalRef.current) {
        clearInterval(skipIntervalRef.current);
      }
    };
  }, [isPlaying, canSkip, skipButtonScale]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && controlsVisible && !isScreenReaderEnabled) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, controlsVisible, isScreenReaderEnabled]);

  // CTA slide-in animation after 3 seconds
  useEffect(() => {
    if (showCTA && currentTime >= 3) {
      ctaSlide.value = withSpring(1);
    }
  }, [currentTime, showCTA, ctaSlide]);

  // ========== HANDLERS ==========

  const handlePlayPause = useCallback(() => {
    if (!player) return;

    if (showThumbnail) {
      setShowThumbnail(false);
      player.play();
      return;
    }

    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, isPlaying, showThumbnail]);

  const handleMuteToggle = useCallback(() => {
    if (!player) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    player.muted = newMuted;
  }, [player, isMuted]);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    
    player?.pause();
    onSkip?.(ad, currentTime);
  }, [canSkip, player, ad, currentTime, onSkip]);

  const handleCTA = useCallback(() => {
    if (ad.targetUrl) {
      Linking.openURL(ad.targetUrl).catch(console.error);
    }
    onCTAPress?.(ad);
  }, [ad, onCTAPress]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsBuffering(true);
    player?.play();
  }, [player]);

  const handleTapControls = useCallback(() => {
    setControlsVisible(true);
    
    // Reset auto-hide timer
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  }, []);

  // ========== ANIMATED STYLES ==========

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const skipButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: skipButtonScale.value }],
  }));

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - ctaSlide.value) * 200 }],
    opacity: ctaSlide.value,
  }));

  // ========== COMPUTED ==========

  const computedHeight = Math.min(SCREEN_WIDTH / aspectRatio, maxHeight);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ========== RENDER ==========

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { height: computedHeight },
        variant === 'fullscreen' && styles.fullscreen,
        style,
      ]}
    >
      <Pressable
        style={styles.videoContainer}
        onPress={handleTapControls}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Sponsored video ad: ${ad.title || 'Advertisement'}. ${isPlaying ? 'Playing' : 'Paused'}. ${canSkip ? 'Tap to skip' : `Skip available in ${skipCountdown} seconds`}`}
      >
        {/* Video Player */}
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          onError={(error) => {
            console.warn('[SkippableVideoAd] VideoView error:', error);
            // Ignore keep-awake related errors in Expo Go
            if (error?.message?.includes('keep awake')) {
              return;
            }
          }}
        />

        {/* Thumbnail Overlay */}
        {showThumbnail && thumbnailUrl && (
          <Animated.View
            style={styles.thumbnailOverlay}
            exiting={FadeOut.duration(300)}
          >
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
              accessibilityLabel="Play video"
              accessibilityRole="button"
            >
              <View style={[styles.playButtonBg, { backgroundColor: withAlpha(colors.primary, 0.9) }]}>
                <Play size={32} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Buffering Indicator */}
        {isBuffering && !hasError && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Error State */}
        {hasError && (
          <Animated.View
            style={[styles.errorOverlay, { backgroundColor: withAlpha('#000000', 0.8) }]}
            entering={FadeIn}
          >
            <Text style={styles.errorText}>Failed to load video</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
              accessibilityLabel="Retry loading video"
            >
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Gradient Overlays */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.6)']}
          locations={[0, 0.2, 0.7, 1]}
          style={styles.gradient}
          pointerEvents="none"
        />

        {/* Top Controls */}
        {controlsVisible && (
          <Animated.View
            style={styles.topControls}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
          >
            {/* Sponsored Badge */}
            <View style={[styles.sponsoredBadge, { backgroundColor: withAlpha('#000000', 0.6) }]}>
              <Text style={styles.sponsoredText}>AD</Text>
            </View>

            {/* Mute Button */}
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: withAlpha('#000000', 0.6) }]}
              onPress={handleMuteToggle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
              accessibilityRole="button"
            >
              {isMuted ? (
                <VolumeX size={20} color="#FFFFFF" />
              ) : (
                <Volume2 size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Skip Button (Right Side) */}
        <Animated.View
          style={[styles.skipContainer, skipButtonAnimatedStyle]}
          entering={SlideInRight.duration(300)}
        >
          <TouchableOpacity
            style={[
              styles.skipButton,
              {
                backgroundColor: canSkip
                  ? withAlpha('#FFFFFF', 0.9)
                  : withAlpha('#000000', 0.6),
              },
            ]}
            onPress={handleSkip}
            disabled={!canSkip}
            accessibilityLabel={canSkip ? 'Skip ad' : `Skip available in ${skipCountdown} seconds`}
            accessibilityRole="button"
          >
            {canSkip ? (
              <>
                <Text style={[styles.skipText, { color: '#000000' }]}>Skip</Text>
                <SkipForward size={16} color="#000000" />
              </>
            ) : (
              <>
                <Clock size={14} color="#FFFFFF" />
                <Text style={[styles.skipText, { color: '#FFFFFF' }]}>{skipCountdown}s</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* CTA Overlay (Bottom Right) */}
        {showCTA && ad.targetUrl && (
          <Animated.View style={[styles.ctaContainer, ctaAnimatedStyle]}>
            <TouchableOpacity
              style={[styles.ctaButton, { backgroundColor: colors.primary }]}
              onPress={handleCTA}
              accessibilityLabel={`${ctaConfig.label}. Opens ${ad.title || 'advertiser'} website`}
              accessibilityRole="link"
            >
              <Text style={[styles.ctaText, { color: colors.primaryText }]}>
                {ctaConfig.label}
              </Text>
              <ExternalLink size={14} color={colors.primaryText} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Center Play/Pause (on tap) */}
        {controlsVisible && !isBuffering && !hasError && !showThumbnail && (
          <Animated.View
            style={styles.centerPlayButton}
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
          >
            <TouchableOpacity
              style={[styles.centerPlayBg, { backgroundColor: withAlpha('#000000', 0.5) }]}
              onPress={handlePlayPause}
              accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={36} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={36} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: withAlpha('#FFFFFF', 0.3) }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary },
                progressAnimatedStyle,
              ]}
            />
          </View>
          
          {/* Time Display */}
          {controlsVisible && (
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Info */}
        {controlsVisible && (
          <Animated.View
            style={styles.bottomInfo}
            entering={SlideInUp.duration(200)}
            exiting={FadeOut.duration(150)}
          >
            <Text style={styles.adTitle} numberOfLines={1}>
              {ad.title || 'Sponsored'}
            </Text>
            {ad.description && (
              <Text style={styles.adDescription} numberOfLines={1}>
                {ad.description}
              </Text>
            )}
          </Animated.View>
        )}
      </Pressable>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  fullscreen: {
    borderRadius: 0,
    height: '100%',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
  },

  // Thumbnail
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  thumbnail: {
    flex: 1,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -35,
    marginLeft: -35,
  },
  playButtonBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Buffering
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Error
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: SPACING.md,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: '#FFFFFF',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFFFFF',
  },

  // Gradient
  gradient: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },

  // Top Controls
  topControls: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  sponsoredBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  sponsoredText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skip Button
  skipContainer: {
    position: 'absolute',
    right: SPACING.sm,
    top: '50%',
    marginTop: -20,
    zIndex: 25,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    minHeight: COMPONENT_SIZE.touchTarget,
  },
  skipText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    right: SPACING.sm,
    bottom: 50,
    zIndex: 20,
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

  // Center Play
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -35,
    marginLeft: -35,
    zIndex: 15,
  },
  centerPlayBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  progressTrack: {
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
  timeContainer: {
    position: 'absolute',
    bottom: 8,
    left: SPACING.sm,
  },
  timeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom Info
  bottomInfo: {
    position: 'absolute',
    bottom: 12,
    left: SPACING.sm,
    right: 100,
    zIndex: 20,
  },
  adTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  adDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const SkippableVideoAd = memo(SkippableVideoAdComponent);
export default SkippableVideoAd;
