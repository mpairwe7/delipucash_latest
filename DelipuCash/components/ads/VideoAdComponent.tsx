/**
 * VideoAdComponent - Enhanced Video Advertisement Player
 * YouTube/Google Ads inspired video player with controls and analytics
 * Design System Compliant - Accessibility, Interactivity, UI Consistency
 */

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  Pressable,
  AccessibilityInfo,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import type { Ad } from '../../types';
import { getBestThumbnailUrl } from '../../utils/thumbnail-utils';

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
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  border: '#E0E0E0',
  youtube: '#FF0000',
  google: '#4285F4',
};

const FONTS = {
  regular: Platform.OS === 'ios' ? 'Avenir' : 'sans-serif',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium',
  bold: Platform.OS === 'ios' ? 'Avenir-Heavy' : 'sans-serif-medium',
};

// ============================================================================
// CTA CONFIGURATION - Industry Standard Call-to-Action Mapping
// ============================================================================

type CTAType = 'learn_more' | 'shop_now' | 'sign_up' | 'download' | 'book_now' |
  'contact_us' | 'get_quote' | 'subscribe' | 'watch_now' | 'play_now' | 'apply_now';

interface CTAConfig {
  label: string;
  icon: string;
}

const CTA_CONFIG: Record<CTAType, CTAConfig> = {
  learn_more: { label: 'Learn More', icon: 'information-circle-outline' },
  shop_now: { label: 'Shop Now', icon: 'cart-outline' },
  sign_up: { label: 'Sign Up', icon: 'person-add-outline' },
  download: { label: 'Download', icon: 'download-outline' },
  book_now: { label: 'Book Now', icon: 'calendar-outline' },
  contact_us: { label: 'Contact Us', icon: 'mail-outline' },
  get_quote: { label: 'Get Quote', icon: 'document-text-outline' },
  subscribe: { label: 'Subscribe', icon: 'notifications-outline' },
  watch_now: { label: 'Watch Now', icon: 'play-circle-outline' },
  play_now: { label: 'Play Now', icon: 'game-controller-outline' },
  apply_now: { label: 'Apply Now', icon: 'checkmark-circle-outline' },
};

// ============================================================================
// TYPES
// ============================================================================

interface VideoAdComponentProps {
  ad: Ad;
  onAdClick?: (ad: Ad) => void;
  onAdLoad?: () => void;
  onAdError?: (error: string) => void;
  onVideoComplete?: (ad: Ad) => void;
  onVideoProgress?: (progress: number, currentTime: number, duration: number) => void;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  showControls?: boolean;
  showThumbnail?: boolean;
  showSkipButton?: boolean;
  skipAfterSeconds?: number;
  aspectRatio?: number;
  maxHeight?: number;
  variant?: 'default' | 'minimal' | 'fullscreen' | 'inline';
  /** Whether the ad is currently visible (for pausing when scrolled away or screen changes) */
  isVisible?: boolean;
  style?: any;
}

interface ControlButtonProps {
  icon: string;
  onPress: () => void;
  size?: number;
  color?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ControlButtonComponent = ({ 
  icon, 
  onPress, 
  size = 24, 
  color = '#FFFFFF',
  accessibilityLabel,
  disabled = false,
}: ControlButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    style={styles.controlButton}
    disabled={disabled}
    accessible
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Ionicons name={icon as any} size={size} color={disabled ? COLORS.textMuted : color} />
  </TouchableOpacity>
);
ControlButtonComponent.displayName = 'ControlButton';
const ControlButton = memo(ControlButtonComponent);

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const VideoAdComponent: React.FC<VideoAdComponentProps> = ({
  ad,
  onAdClick,
  onAdLoad,
  onAdError,
  onVideoComplete,
  onVideoProgress,
  autoPlay = false,
  muted: initialMuted = true,
  loop = false,
  showControls = true,
  showThumbnail = true,
  showSkipButton = true,
  skipAfterSeconds = 5,
  aspectRatio = 16 / 9,
  maxHeight = 300,
  variant = 'default',
  isVisible = true,
  style,
}) => {
  // ========== STATE (called unconditionally) ==========
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showingThumbnail, setShowingThumbnail] = useState(showThumbnail);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(skipAfterSeconds);
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  // ========== REFS ==========
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ========== ANIMATIONS ==========
  const controlsOpacity = useSharedValue(1);
  const progressWidth = useSharedValue(0);
  const playButtonScale = useSharedValue(1);

  // Check if ad is valid
  const isValidAd = ad && typeof ad === 'object' && ad.id;

  // ========== VIDEO PLAYER ==========
  const videoPlayer = useVideoPlayer(isValidAd ? (ad.videoUrl || '') : '', (player) => {
    try {
      player.loop = loop;
      player.muted = isMuted;

      if (autoPlay && !showThumbnail) {
        player.play();
      }
    } catch (error) {
      console.warn('[VideoAdComponent] Error configuring player:', error);
    }
  });

  // ========== EFFECTS ==========

  // Check for screen reader
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );
    return () => subscription.remove();
  }, []);

  // Load thumbnail
  useEffect(() => {
    if (!isValidAd) return;

    const loadThumbnail = async () => {
      if (ad.thumbnailUrl) {
        setThumbnailUrl(ad.thumbnailUrl);
        return;
      }

      if (ad.imageUrl) {
        setThumbnailUrl(ad.imageUrl);
        return;
      }

      if (ad.videoUrl) {
        setIsLoadingThumbnail(true);
        try {
          // Convert Ad to AdWithMedia format (null -> undefined)
          const adWithMedia = {
            thumbnailUrl: ad.thumbnailUrl ?? undefined,
            videoUrl: ad.videoUrl ?? undefined,
            imageUrl: ad.imageUrl ?? undefined,
          };
          const generated = await getBestThumbnailUrl(adWithMedia);
          setThumbnailUrl(generated);
        } catch (err) {
          console.error('Error generating thumbnail:', err);
          setThumbnailUrl('https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=300&fit=crop');
        } finally {
          setIsLoadingThumbnail(false);
        }
      }
    };

    loadThumbnail();
  }, [ad, isValidAd]);

  // Video player status subscription
  useEffect(() => {
    if (!videoPlayer || !isValidAd) return;

    const statusSubscription = videoPlayer.addListener('statusChange', (event) => {
      const status = event.status;
      if (status === 'readyToPlay') {
        setIsBuffering(false);
        onAdLoad?.();
      } else if (status === 'loading') {
        setIsBuffering(true);
      } else if (status === 'error') {
        setError('Failed to load video');
        onAdError?.('Failed to load video');
      }
    });

    const playingSubscription = videoPlayer.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
    };
  }, [videoPlayer, onAdLoad, onAdError, isValidAd]);

  // Handle visibility changes (pause when scrolled off screen or screen loses focus)
  // Industry standard: videos should pause when not visible to save resources and avoid sound overlap
  useEffect(() => {
    if (!isVisible && isPlaying && videoPlayer) {
      try {
        videoPlayer.pause();
        setIsPlaying(false);
      } catch {
        // Player may be released
      }
    }
  }, [isVisible, isPlaying, videoPlayer]);

  // Industry Standard: Pause video when app goes to background
  // Following TikTok/YouTube/Instagram pattern - videos should pause when app is backgrounded
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      const isActive = nextAppState === 'active';

      if (wasActive && !isActive && videoPlayer) {
        // App going to background - pause video
        try {
          videoPlayer.pause();
          setIsPlaying(false);
        } catch {
          // Player may be released
        }
      }
      // Note: We don't auto-resume on foreground - user should tap play

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [videoPlayer]);

  // Progress tracking
  useEffect(() => {
    if (isPlaying && videoPlayer && isValidAd) {
      progressIntervalRef.current = setInterval(() => {
        const current = videoPlayer.currentTime || 0;
        const total = videoPlayer.duration || 0;
        
        setCurrentTime(current);
        setDuration(total);
        
        if (total > 0) {
          progressWidth.value = withTiming((current / total) * 100, { duration: 100 });
          onVideoProgress?.(Math.round((current / total) * 100), current, total);
        }

        // Check for video completion
        if (current >= total - 0.5 && total > 0) {
          onVideoComplete?.(ad);
        }
      }, 250);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, videoPlayer, ad, onVideoProgress, onVideoComplete, progressWidth, isValidAd]);

  // Skip countdown
  useEffect(() => {
    if (isPlaying && showSkipButton && !canSkip) {
      skipTimeoutRef.current = setInterval(() => {
        setSkipCountdown((prev) => {
          if (prev <= 1) {
            setCanSkip(true);
            if (skipTimeoutRef.current) {
              clearInterval(skipTimeoutRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (skipTimeoutRef.current) {
        clearInterval(skipTimeoutRef.current);
      }
    };
  }, [isPlaying, showSkipButton, canSkip]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && controlsVisible && !isScreenReaderEnabled) {
      controlsTimeoutRef.current = setTimeout(() => {
        controlsOpacity.value = withTiming(0, { duration: 300 });
        setControlsVisible(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, controlsVisible, isScreenReaderEnabled, controlsOpacity]);

  // ========== HANDLERS ==========

  const handlePlayPause = useCallback(() => {
    if (showingThumbnail) {
      setShowingThumbnail(false);
      videoPlayer?.play();
      return;
    }

    if (isPlaying) {
      videoPlayer?.pause();
    } else {
      videoPlayer?.play();
    }

    // Animate play button
    playButtonScale.value = withSequence(
      withSpring(0.8),
      withSpring(1)
    );
  }, [showingThumbnail, isPlaying, videoPlayer, playButtonScale]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoPlayer) {
      videoPlayer.muted = newMuted;
    }
  }, [isMuted, videoPlayer]);

  const handleFullscreen = useCallback(() => {
    // This would trigger fullscreen mode
    // Implementation depends on navigation/modal system
    console.log('Fullscreen requested');
  }, []);

  const handleReplay = useCallback(() => {
    if (videoPlayer) {
      videoPlayer.currentTime = 0;
      videoPlayer.play();
    }
    setCanSkip(false);
    setSkipCountdown(skipAfterSeconds);
  }, [videoPlayer, skipAfterSeconds]);

  const handleSkip = useCallback(() => {
    if (canSkip) {
      videoPlayer?.pause();
      onVideoComplete?.(ad);
    }
  }, [canSkip, videoPlayer, ad, onVideoComplete]);

  const handleAdClick = useCallback(() => {
    onAdClick?.(ad);
  }, [ad, onAdClick]);

  const handleShowControls = useCallback(() => {
    controlsOpacity.value = withTiming(1, { duration: 200 });
    setControlsVisible(true);
  }, [controlsOpacity]);

  // ========== ANIMATED STYLES ==========

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  // ========== CALCULATIONS ==========

  const calculatedHeight = Math.min(SCREEN_WIDTH / aspectRatio, maxHeight);

  // Safety check - render null for invalid ad
  if (!isValidAd) {
    console.warn('VideoAdComponent: Invalid ad object provided');
    return null;
  }

  // ========== RENDER ==========

  if (error) {
    return (
      <View style={[styles.container, { height: calculatedHeight }, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setShowingThumbnail(true);
            }}
            accessible
            accessibilityLabel="Retry loading video"
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View 
      style={[styles.container, { height: calculatedHeight }, style]}
      accessible
      accessibilityLabel={`Video advertisement: ${ad.title}`}
      accessibilityHint="Tap to play or pause the video"
    >
      {/* Video Player */}
      {!showingThumbnail && ad.videoUrl && (
        <Pressable 
          onPress={handleShowControls} 
          style={styles.videoWrapper}
          accessible={false}
        >
          <VideoView
            player={videoPlayer}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            onError={(error) => {
              console.warn('[VideoAdComponent] VideoView error:', error);
              // Ignore keep-awake related errors in Expo Go
              if (error?.message?.includes('keep awake')) {
                return;
              }
            }}
          />
        </Pressable>
      )}

      {/* Thumbnail Overlay */}
      {showingThumbnail && (
        <Animated.View
          style={styles.thumbnailContainer}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
        >
          {isLoadingThumbnail ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              accessible
              accessibilityLabel="Video thumbnail"
            />
          ) : (
            <LinearGradient
              colors={[COLORS.surface, '#E3E3E3']}
              style={styles.placeholderGradient}
            >
              <Ionicons name="videocam-outline" size={48} color={COLORS.textMuted} />
            </LinearGradient>
          )}

          {/* Big Play Button */}
          <TouchableOpacity
            style={styles.bigPlayButton}
            onPress={handlePlayPause}
            accessible
            accessibilityLabel="Play video"
            accessibilityRole="button"
          >
            <Animated.View style={[styles.bigPlayButtonInner, playButtonAnimatedStyle]}>
              <LinearGradient
                colors={[COLORS.youtube, '#CC0000']}
                style={styles.playButtonGradient}
              >
                <Ionicons name="play" size={32} color="#FFFFFF" style={styles.playIcon} />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !showingThumbnail && (
        <View style={styles.bufferingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.bufferingText}>Buffering...</Text>
        </View>
      )}

      {/* Controls Overlay */}
      {showControls && !showingThumbnail && (
        <Animated.View style={[styles.controlsOverlay, controlsAnimatedStyle]}>
          {/* Top Controls - Sponsored Badge & Info */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.topGradient}
          >
            <View style={styles.topControls}>
              {ad.sponsored && (
                <View style={styles.sponsoredBadge}>
                  <Text style={styles.sponsoredText}>Ad</Text>
                </View>
              )}
              <View style={styles.topTitleContainer}>
                {ad.headline && (
                  <Text style={styles.adHeadline} numberOfLines={1}>
                    {ad.headline}
                  </Text>
                )}
                <Text style={styles.adTitle} numberOfLines={1}>
                  {ad.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.infoButton}
                onPress={handleAdClick}
                accessible
                accessibilityLabel="More information about this ad"
                accessibilityRole="button"
              >
                <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Center Play/Pause Button */}
          <Pressable style={styles.centerControls} onPress={handlePlayPause}>
            <Animated.View style={playButtonAnimatedStyle}>
              <View style={styles.centerPlayButton}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={48}
                  color="#FFFFFF"
                  style={!isPlaying && styles.playIcon}
                />
              </View>
            </Animated.View>
          </Pressable>

          {/* Bottom Controls */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
          >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
              </View>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Control Buttons */}
            <View style={styles.bottomControls}>
              <View style={styles.leftControls}>
                <ControlButton
                  icon={isPlaying ? 'pause' : 'play'}
                  onPress={handlePlayPause}
                  accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
                />
                <ControlButton
                  icon={isMuted ? 'volume-mute' : 'volume-high'}
                  onPress={handleMuteToggle}
                  accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
                />
                <ControlButton
                  icon="refresh"
                  onPress={handleReplay}
                  accessibilityLabel="Replay video"
                />
              </View>

              <View style={styles.rightControls}>
                {/* Dynamic CTA Button */}
                {(() => {
                  const ctaType = (ad.callToAction as CTAType) || 'learn_more';
                  const ctaConfig = CTA_CONFIG[ctaType] || CTA_CONFIG.learn_more;
                  return (
                    <TouchableOpacity
                      style={styles.learnMoreButton}
                      onPress={handleAdClick}
                      accessible
                      accessibilityLabel={`${ctaConfig.label}: ${ad.title}`}
                      accessibilityRole="button"
                    >
                      <Ionicons name={ctaConfig.icon as any} size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.learnMoreText}>{ctaConfig.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  );
                })()}

                <ControlButton
                  icon="expand"
                  onPress={handleFullscreen}
                  accessibilityLabel="Fullscreen"
                />
              </View>
            </View>
          </LinearGradient>

          {/* Skip Button (YouTube style) */}
          {showSkipButton && (
            <Animated.View
              style={styles.skipButtonContainer}
              entering={SlideInUp.delay(300).duration(400)}
            >
              <TouchableOpacity
                style={[
                  styles.skipButton,
                  canSkip ? styles.skipButtonActive : styles.skipButtonDisabled,
                ]}
                onPress={handleSkip}
                disabled={!canSkip}
                accessible
                accessibilityLabel={canSkip ? 'Skip ad' : `Skip ad in ${skipCountdown} seconds`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSkip }}
              >
                {canSkip ? (
                  <>
                    <Text style={styles.skipButtonText}>Skip Ad</Text>
                    <Ionicons name="play-skip-forward" size={16} color="#FFFFFF" />
                  </>
                ) : (
                  <Text style={styles.skipCountdownText}>
                    Skip in {skipCountdown}s
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Minimal Variant - Just Video Indicator */}
      {variant === 'minimal' && !showingThumbnail && (
        <View style={styles.minimalIndicator}>
          <View style={styles.minimalDot} />
          <Text style={styles.minimalText}>AD</Text>
        </View>
      )}
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
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  videoWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // Thumbnail
  thumbnailContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Big Play Button (YouTube style)
  bigPlayButton: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigPlayButtonInner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonGradient: {
    width: 68,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    marginLeft: 4, // Visual centering for play icon
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    fontSize: 14,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
    fontSize: 14,
  },

  // Buffering
  bufferingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.overlayLight,
  },
  bufferingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
    fontSize: 14,
  },

  // Controls Overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top Controls
  topGradient: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sponsoredBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  sponsoredText: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  topTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  adHeadline: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  adTitle: {
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  infoButton: {
    padding: 4,
  },

  // Center Controls
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Controls
  bottomGradient: {
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.youtube,
    borderRadius: 1.5,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
    fontSize: 11,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Learn More Button
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  learnMoreText: {
    color: '#FFFFFF',
    fontFamily: FONTS.medium,
    fontSize: 12,
  },

  // Skip Button (YouTube style)
  skipButtonContainer: {
    position: 'absolute',
    bottom: 70,
    right: 0,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  skipButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  skipButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  skipButtonText: {
    color: '#000000',
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  skipCountdownText: {
    color: '#FFFFFF',
    fontFamily: FONTS.regular,
    fontSize: 13,
  },

  // Minimal Variant
  minimalIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  minimalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.youtube,
  },
  minimalText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
});

export default memo(VideoAdComponent);
