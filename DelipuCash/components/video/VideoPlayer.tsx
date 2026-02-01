/**
 * VideoPlayer Component - Enhanced YouTube-like Experience
 * Full-screen modal video player with advanced controls, gestures, and animations
 * 
 * Features:
 * - Expo Video integration with comprehensive playback controls
 * - Double-tap to seek (left/right side of screen) like YouTube
 * - Playback speed control (0.5x - 2x)
 * - Quality selection (Auto, 1080p, 720p, 480p, 360p)
 * - Swipe gestures for volume (right side) and brightness (left side)
 * - Enhanced buffering states with visual feedback
 * - Replay functionality when video ends
 * - Smooth slider seek with position preview
 * - Accessibility labels and roles for screen readers
 * - Haptic feedback on interactions
 * - Animated control visibility with auto-hide
 * - Picture-in-picture and fullscreen support
 * 
 * @example
 * ```tsx
 * <VideoPlayer
 *   videoSource="https://example.com/video.mp4"
 *   videoDetails={videoData}
 *   onClose={() => setPlayerVisible(false)}
 * />
 * ```
 */

import React, { useCallback, useEffect, useRef, useState, memo, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  StatusBar,
  PanResponder,
  GestureResponderEvent,
  Pressable,
  AppState,
  AppStateStatus,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Share2,
  Heart,
  Eye,
  RotateCcw,
  Settings,
  ChevronRight,
  Check,
  Gauge,
  MonitorPlay,
  Sun,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  ANIMATION,
  withAlpha,
  COMPONENT_SIZE,
} from '@/utils/theme';
import { Video } from '@/types';
import { ProgressBar } from '../ui/ProgressBar';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

// Control visibility timeout (ms)
const CONTROLS_HIDE_DELAY = 3000;

// Skip duration in seconds
const SKIP_DURATION = 10;

// Double tap timeout (ms)
const DOUBLE_TAP_DELAY = 300;

// Seek amount for double tap (seconds)
const DOUBLE_TAP_SEEK = 10;

// Swipe gesture sensitivity
const SWIPE_THRESHOLD = 10;

// Volume/Brightness change sensitivity
const GESTURE_SENSITIVITY = 0.005;

// ============================================================================
// ENUMS & TYPES
// ============================================================================

/**
 * Playback state enum for better state management
 */
enum PlaybackState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Buffering = 'buffering',
  Ended = 'ended',
  Error = 'error',
}

/**
 * Settings menu types
 */
enum SettingsMenu {
  None = 'none',
  Main = 'main',
  Speed = 'speed',
  Quality = 'quality',
}

/**
 * Playback speed options
 */
const PLAYBACK_SPEEDS = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: 'Normal', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '1.75x', value: 1.75 },
  { label: '2x', value: 2 },
];

/**
 * Quality options (simulated - actual implementation depends on video source)
 */
const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
];

/**
 * Props for the VideoPlayer component
 */
export interface VideoPlayerProps {
  /** Video source URL */
  videoSource: string | null;
  /** Video metadata */
  videoDetails: Video | null;
  /** Callback when player is closed */
  onClose: () => void;
  /** Callback when video is liked */
  onLike?: () => void;
  /** Callback when video is shared */
  onShare?: () => void;
  /** Whether video is already liked */
  isLiked?: boolean;
  /** Auto-play video when opened */
  autoPlay?: boolean;
  /** Enable looping */
  loop?: boolean;
  /** Initial playback speed */
  initialSpeed?: number;
  /** Callback when playback speed changes */
  onSpeedChange?: (speed: number) => void;
  /** Callback when video ends */
  onVideoEnd?: () => void;
  /** Whether the screen containing the player is focused (for pausing on navigation) */
  isFocused?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format seconds to MM:SS or HH:MM:SS display
 */
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format number to human-readable string (K, M, B)
 */
const formatCount = (count: number): string => {
  if (count >= 1000000000) return `${(count / 1000000000).toFixed(1)}B`;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * Get playback speed label
 */
const getSpeedLabel = (speed: number): string => {
  const option = PLAYBACK_SPEEDS.find(s => s.value === speed);
  return option?.label || `${speed}x`;
};

/**
 * VideoPlayer Component
 * Enhanced YouTube-like video player with gestures and advanced controls
 */
function VideoPlayerComponent({
  videoSource,
  videoDetails,
  onClose,
  onLike,
  onShare,
  isLiked = false,
  autoPlay = true,
  loop = false,
  initialSpeed = 1,
  onSpeedChange,
  onVideoEnd,
  isFocused = true,
  testID,
}: VideoPlayerProps): React.ReactElement | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  // Playback state (enum-based for better state management)
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.Loading);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [bufferedProgress, setBufferedProgress] = useState(0);

  // Playback speed & quality
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSpeed);
  const [quality, setQuality] = useState('auto');

  // Volume & brightness for gestures
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(0.5);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);

  // Controls visibility
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings menu
  const [settingsMenu, setSettingsMenu] = useState<SettingsMenu>(SettingsMenu.None);

  // Double-tap seek animation
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const [seekAmount, setSeekAmount] = useState(0);
  const seekAnimationOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seek preview
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState(0);

  // Gesture tracking
  const gestureStartValue = useRef({ volume: 1, brightness: 0.5 });
  const isGestureActive = useRef(false);

  // ============================================================================
  // VIDEO PLAYER INITIALIZATION
  // ============================================================================

  // Initialize video player
  const player = useVideoPlayer(videoSource || '', (playerInstance) => {
    playerInstance.loop = loop;
    playerInstance.volume = volume;
    if (autoPlay) {
      playerInstance.play();
    }
  });

  // Derived state
  const isPlaying = playbackState === PlaybackState.Playing;
  const isBuffering = playbackState === PlaybackState.Buffering;
  const isLoading = playbackState === PlaybackState.Loading;
  const hasEnded = playbackState === PlaybackState.Ended;
  const hasError = playbackState === PlaybackState.Error;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Subscribe to player events
  useEffect(() => {
    if (!player) return;

    const handleTimeUpdate = () => {
      const current = player.currentTime || 0;
      const total = player.duration || 0;
      setCurrentTime(current);
      setDuration(total);

      if (total > 0) {
        setProgress(current / total);

        // Check if video ended (within 0.5 seconds of end)
        if (current >= total - 0.5 && !loop) {
          setPlaybackState(PlaybackState.Ended);
          onVideoEnd?.();
        } else if (player.playing) {
          setPlaybackState(PlaybackState.Playing);
        }
      }
    };

    // Initial loading complete
    const checkLoading = () => {
      if (player.duration > 0) {
        setPlaybackState(autoPlay ? PlaybackState.Playing : PlaybackState.Paused);
      }
    };

    // Check status periodically
    const interval = setInterval(() => {
      if (player) {
        handleTimeUpdate();
        checkLoading();

        // Update playback state based on player status
        if (player.playing && playbackState !== PlaybackState.Playing) {
          setPlaybackState(PlaybackState.Playing);
        } else if (!player.playing && playbackState === PlaybackState.Playing) {
          // Could be buffering or paused
          if (player.currentTime < player.duration - 0.5) {
            setPlaybackState(PlaybackState.Paused);
          }
        }
      }
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [player, autoPlay, loop, onVideoEnd, playbackState]);

  // Apply playback speed when it changes
  useEffect(() => {
    if (player) {
      player.playbackRate = playbackSpeed;
      onSpeedChange?.(playbackSpeed);
    }
  }, [player, playbackSpeed, onSpeedChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
      // Safely pause player - wrap in try-catch to handle released player
      try {
        player?.pause();
      } catch {
        // Player may have been released already, ignore
      }
      // Reset orientation to portrait when closing
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    };
  }, [player]);

  // Industry Standard: Pause video when app goes to background
  // Following TikTok/YouTube/Instagram pattern - videos should pause when app is backgrounded
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      const isActive = nextAppState === 'active';

      if (wasActive && !isActive) {
        // App going to background - pause video
        try {
          player?.pause();
          setPlaybackState(PlaybackState.Paused);
        } catch {
          // Player may be released
        }
      }
      // Note: We don't auto-resume on foreground - user should tap play
      // This is the industry standard (TikTok/YouTube behavior)

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Industry Standard: Pause video when screen loses focus (navigation away)
  // Following YouTube/TikTok pattern - videos should pause when navigating to another screen
  useEffect(() => {
    if (!isFocused && isPlaying) {
      try {
        player?.pause();
        setPlaybackState(PlaybackState.Paused);
      } catch {
        // Player may be released
      }
    }
    // Note: We don't auto-resume on focus return - user should tap play
  }, [isFocused, isPlaying, player]);

  // Handle fullscreen orientation changes
  useEffect(() => {
    const updateOrientation = async () => {
      try {
        if (isFullscreen) {
          // Lock to landscape when fullscreen
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          // Return to portrait when exiting fullscreen
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (error) {
        console.warn('Failed to change orientation:', error);
      }
    };
    updateOrientation();
  }, [isFullscreen]);

  // ============================================================================
  // CONTROL VISIBILITY HANDLERS
  // ============================================================================

  // Auto-hide controls
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying && settingsMenu === SettingsMenu.None) {
      hideControlsTimer.current = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: ANIMATION.duration.slow,
          useNativeDriver: true,
        }).start(() => setControlsVisible(false));
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, controlsOpacity, settingsMenu]);

  // Show controls
  const showControls = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: ANIMATION.duration.normal,
      useNativeDriver: true,
    }).start();
    scheduleHideControls();
  }, [controlsOpacity, scheduleHideControls]);

  // Hide controls immediately
  const hideControls = useCallback(() => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: ANIMATION.duration.normal,
      useNativeDriver: true,
    }).start(() => setControlsVisible(false));
  }, [controlsOpacity]);

  // ============================================================================
  // DOUBLE-TAP SEEK HANDLER (YouTube-style)
  // ============================================================================

  const handleDoubleTapSeek = useCallback((side: 'left' | 'right') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const seekDirection = side === 'right' ? 1 : -1;
    const seekTime = DOUBLE_TAP_SEEK * seekDirection;

    if (player && duration > 0) {
      const newTime = Math.max(0, Math.min(currentTime + seekTime, duration));
      player.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(newTime / duration);
    }

    // Accumulate seek amount for display
    setSeekAmount(prev => {
      if (doubleTapSide === side) {
        return prev + DOUBLE_TAP_SEEK;
      }
      return DOUBLE_TAP_SEEK;
    });
    setDoubleTapSide(side);

    // Animate seek indicator
    seekAnimationOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(seekAnimationOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDoubleTapSide(null);
      setSeekAmount(0);
    });
  }, [player, duration, currentTime, doubleTapSide, seekAnimationOpacity]);

  // ============================================================================
  // TAP HANDLER (Single tap = toggle controls, Double tap = seek)
  // ============================================================================

  const handleTap = useCallback((event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    const now = Date.now();
    const isLeftSide = locationX < SCREEN_WIDTH / 2;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      handleDoubleTapSeek(isLeftSide ? 'left' : 'right');
    } else {
      // Potential single tap - wait to see if it becomes double tap
      tapTimeoutRef.current = setTimeout(() => {
        if (controlsVisible) {
          hideControls();
        } else {
          showControls();
        }
      }, DOUBLE_TAP_DELAY);
    }

    lastTapRef.current = now;
  }, [controlsVisible, hideControls, showControls, handleDoubleTapSeek]);

  // ============================================================================
  // GESTURE HANDLERS (Volume & Brightness)
  // ============================================================================

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > SWIPE_THRESHOLD;
    },
    onPanResponderGrant: (event) => {
      const { locationX } = event.nativeEvent;
      isGestureActive.current = true;
      gestureStartValue.current = {
        volume,
        brightness,
      };

      // Determine which side for volume/brightness
      if (locationX > SCREEN_WIDTH / 2) {
        setShowVolumeIndicator(true);
      } else {
        setShowBrightnessIndicator(true);
      }
    },
    onPanResponderMove: async (event, gestureState) => {
      if (!isGestureActive.current) return;

      const { locationX } = event.nativeEvent;
      const deltaY = -gestureState.dy * GESTURE_SENSITIVITY;

      if (locationX > SCREEN_WIDTH / 2) {
        // Right side - Volume control
        const newVolume = Math.max(0, Math.min(1, gestureStartValue.current.volume + deltaY));
        setVolume(newVolume);
        if (player) {
          player.volume = newVolume;
        }
      } else {
        // Left side - Brightness control (visual indicator only - actual brightness requires expo-brightness)
        const newBrightness = Math.max(0, Math.min(1, gestureStartValue.current.brightness + deltaY));
        setBrightness(newBrightness);
        // Note: To enable actual brightness control, install expo-brightness and uncomment:
        // await Brightness.setBrightnessAsync(newBrightness);
      }
    },
    onPanResponderRelease: () => {
      isGestureActive.current = false;
      setShowVolumeIndicator(false);
      setShowBrightnessIndicator(false);
    },
  }), [volume, brightness, player]);

  // ============================================================================
  // PLAYBACK CONTROLS
  // ============================================================================

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (hasEnded) {
        // Replay from beginning
        if (player) {
          player.currentTime = 0;
          player.play();
          setPlaybackState(PlaybackState.Playing);
          setProgress(0);
          setCurrentTime(0);
        }
      } else if (isPlaying) {
        player?.pause();
        setPlaybackState(PlaybackState.Paused);
      } else {
        player?.play();
        setPlaybackState(PlaybackState.Playing);
      }
    } catch {
    // Player may have been released, ignore
    }
    showControls();
  }, [hasEnded, isPlaying, player, showControls]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      player.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    showControls();
  }, [isMuted, player, showControls]);

  // Seek to position (from slider)
  const handleSeek = useCallback((seekProgress: number) => {
    if (player && duration > 0) {
      const seekTime = seekProgress * duration;
      player.currentTime = seekTime;
      setCurrentTime(seekTime);
      setProgress(seekProgress);

      // If video had ended, restart playback
      if (hasEnded) {
        setPlaybackState(PlaybackState.Playing);
        player.play();
      }
    }
    showControls();
  }, [player, duration, hasEnded, showControls]);

  // Seeking started (for preview)
  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Seeking in progress (for preview)
  const handleSeeking = useCallback((seekProgress: number) => {
    if (duration > 0) {
      setSeekPreviewTime(seekProgress * duration);
    }
  }, [duration]);

  // Seeking ended
  const handleSeekEnd = useCallback((seekProgress: number) => {
    setIsSeeking(false);
    handleSeek(seekProgress);
  }, [handleSeek]);

  // Skip forward
  const skipForward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player && duration > 0) {
      const newTime = Math.min(currentTime + SKIP_DURATION, duration);
      player.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(newTime / duration);
    }
    showControls();
  }, [player, currentTime, duration, showControls]);

  // Skip backward
  const skipBackward = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      const newTime = Math.max(currentTime - SKIP_DURATION, 0);
      player.currentTime = newTime;
      setCurrentTime(newTime);
      if (duration > 0) {
        setProgress(newTime / duration);
      }
    }
    showControls();
  }, [player, currentTime, duration, showControls]);

  // ============================================================================
  // SETTINGS HANDLERS
  // ============================================================================

  // Toggle settings menu
  const toggleSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsMenu(prev => prev === SettingsMenu.None ? SettingsMenu.Main : SettingsMenu.None);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
  }, []);

  // Set playback speed
  const handleSpeedChange = useCallback((speed: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlaybackSpeed(speed);
    setSettingsMenu(SettingsMenu.None);
    showControls();
  }, [showControls]);

  // Set quality
  const handleQualityChange = useCallback((newQuality: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuality(newQuality);
    setSettingsMenu(SettingsMenu.None);
    showControls();
    // Note: Actual quality change implementation depends on video source support
  }, [showControls]);

  // ============================================================================
  // OTHER HANDLERS
  // ============================================================================

  // Handle close
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Safely pause player - wrap in try-catch to handle released player
    try {
      player?.pause();
    } catch {
      // Player may have been released already, ignore
    }
    onClose();
  }, [player, onClose]);

  // Handle like
  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike?.();
    showControls();
  }, [onLike, showControls]);

  // Handle share
  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onShare?.();
    showControls();
  }, [onShare, showControls]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  // Render settings menu
  const renderSettingsMenu = () => {
    if (settingsMenu === SettingsMenu.None) return null;

    return (
      <View style={[styles.settingsOverlay, { backgroundColor: withAlpha(colors.background, 0.95) }]}>
        <TouchableOpacity
          style={styles.settingsBackdrop}
          activeOpacity={1}
          onPress={() => setSettingsMenu(SettingsMenu.None)}
        />
        <View style={[styles.settingsContainer, { backgroundColor: colors.card }]}>
          {settingsMenu === SettingsMenu.Main && (
            <>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => setSettingsMenu(SettingsMenu.Speed)}
              >
                <View style={styles.settingsItemLeft}>
                  <Gauge size={ICON_SIZE.md} color={colors.text} strokeWidth={2} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Playback Speed</Text>
                </View>
                <View style={styles.settingsItemRight}>
                  <Text style={[styles.settingsItemValue, { color: colors.textMuted }]}>
                    {getSpeedLabel(playbackSpeed)}
                  </Text>
                  <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => setSettingsMenu(SettingsMenu.Quality)}
              >
                <View style={styles.settingsItemLeft}>
                  <MonitorPlay size={ICON_SIZE.md} color={colors.text} strokeWidth={2} />
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>Quality</Text>
                </View>
                <View style={styles.settingsItemRight}>
                  <Text style={[styles.settingsItemValue, { color: colors.textMuted }]}>
                    {quality === 'auto' ? 'Auto' : `${quality}p`}
                  </Text>
                  <ChevronRight size={ICON_SIZE.sm} color={colors.textMuted} strokeWidth={2} />
                </View>
              </TouchableOpacity>
            </>
          )}

          {settingsMenu === SettingsMenu.Speed && (
            <>
              <TouchableOpacity
                style={styles.settingsHeader}
                onPress={() => setSettingsMenu(SettingsMenu.Main)}
              >
                <ChevronRight
                  size={ICON_SIZE.md}
                  color={colors.text}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Playback Speed</Text>
              </TouchableOpacity>
              {PLAYBACK_SPEEDS.map((speed) => (
                <TouchableOpacity
                  key={speed.value}
                  style={styles.settingsItem}
                  onPress={() => handleSpeedChange(speed.value)}
                >
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>
                    {speed.label}
                  </Text>
                  {playbackSpeed === speed.value && (
                    <Check size={ICON_SIZE.md} color={colors.primary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          {settingsMenu === SettingsMenu.Quality && (
            <>
              <TouchableOpacity
                style={styles.settingsHeader}
                onPress={() => setSettingsMenu(SettingsMenu.Main)}
              >
                <ChevronRight
                  size={ICON_SIZE.md}
                  color={colors.text}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
                <Text style={[styles.settingsTitle, { color: colors.text }]}>Quality</Text>
              </TouchableOpacity>
              {QUALITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.settingsItem}
                  onPress={() => handleQualityChange(option.value)}
                >
                  <Text style={[styles.settingsItemText, { color: colors.text }]}>
                    {option.label}
                  </Text>
                  {quality === option.value && (
                    <Check size={ICON_SIZE.md} color={colors.primary} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </View>
    );
  };

  // Don't render if no video source
  if (!videoSource) return null;

  return (
    <Modal
      visible={!!videoSource}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
      testID={testID}
    >
      <StatusBar hidden />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Video View with Gesture Handler */}
        <View style={styles.videoContainer} {...panResponder.panHandlers}>
          <Pressable
            onPress={handleTap}
            style={styles.videoTouchable}
          >
            <VideoView
              style={styles.video}
              player={player}
              fullscreenOptions={{ enable: true }}
              allowsPictureInPicture
              contentFit="contain"
              nativeControls={false}
            />
          </Pressable>

          {/* Double Tap Seek Indicator - Left */}
          {doubleTapSide === 'left' && (
            <Animated.View
              style={[
                styles.doubleTapIndicator,
                styles.doubleTapLeft,
                { opacity: seekAnimationOpacity },
              ]}
            >
              <View style={styles.doubleTapContent}>
                <SkipBack size={ICON_SIZE['2xl']} color="#fff" strokeWidth={2} />
                <Text style={styles.doubleTapText}>{seekAmount} seconds</Text>
              </View>
            </Animated.View>
          )}

          {/* Double Tap Seek Indicator - Right */}
          {doubleTapSide === 'right' && (
            <Animated.View
              style={[
                styles.doubleTapIndicator,
                styles.doubleTapRight,
                { opacity: seekAnimationOpacity },
              ]}
            >
              <View style={styles.doubleTapContent}>
                <SkipForward size={ICON_SIZE['2xl']} color="#fff" strokeWidth={2} />
                <Text style={styles.doubleTapText}>{seekAmount} seconds</Text>
              </View>
            </Animated.View>
          )}

          {/* Volume Indicator */}
          {showVolumeIndicator && (
            <View style={[styles.gestureIndicator, { backgroundColor: withAlpha(colors.card, 0.9) }]}>
              {volume > 0 ? (
                <Volume2 size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
              ) : (
                <VolumeX size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
              )}
              <View style={styles.gestureIndicatorBar}>
                <View
                  style={[
                    styles.gestureIndicatorFill,
                    { width: `${volume * 100}%`, backgroundColor: colors.primary },
                  ]}
                />
              </View>
              <Text style={[styles.gestureIndicatorText, { color: colors.text }]}>
                {Math.round(volume * 100)}%
              </Text>
            </View>
          )}

          {/* Brightness Indicator */}
          {showBrightnessIndicator && (
            <View style={[styles.gestureIndicator, { backgroundColor: withAlpha(colors.card, 0.9) }]}>
              <Sun size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
              <View style={styles.gestureIndicatorBar}>
                <View
                  style={[
                    styles.gestureIndicatorFill,
                    { width: `${brightness * 100}%`, backgroundColor: colors.warning },
                  ]}
                />
              </View>
              <Text style={[styles.gestureIndicatorText, { color: colors.text }]}>
                {Math.round(brightness * 100)}%
              </Text>
            </View>
          )}

          {/* Loading Indicator */}
          {(isLoading || isBuffering) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                {isBuffering ? 'Buffering...' : 'Loading video...'}
              </Text>
            </View>
          )}

          {/* Error State */}
          {hasError && (
            <View style={styles.errorOverlay}>
              <Text style={[styles.errorText, { color: colors.error }]}>
                Failed to load video
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.errorButton, { backgroundColor: colors.primary }]}
                accessibilityLabel="Close video player"
                accessibilityRole="button"
              >
                <Text style={[styles.errorButtonText, { color: colors.primaryText }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Seek Preview (when dragging slider) */}
          {isSeeking && (
            <View style={[styles.seekPreview, { backgroundColor: withAlpha(colors.card, 0.9) }]}>
              <Text style={[styles.seekPreviewTime, { color: colors.text }]}>
                {formatDuration(seekPreviewTime)}
              </Text>
            </View>
          )}

          {/* Controls Overlay */}
          <Animated.View
            style={[
              styles.controlsOverlay,
              {
                opacity: controlsOpacity,
                paddingTop: insets.top + SPACING.md,
                paddingBottom: insets.bottom + SPACING.md,
              },
            ]}
            pointerEvents={controlsVisible ? 'auto' : 'none'}
          >
            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.iconButton, { backgroundColor: withAlpha(colors.card, 0.8) }]}
                accessibilityLabel="Close video player"
                accessibilityRole="button"
                accessibilityHint="Returns to previous screen"
              >
                <X size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.topActions}>
                <TouchableOpacity
                  onPress={toggleSettings}
                  style={[styles.iconButton, { backgroundColor: withAlpha(colors.card, 0.8) }]}
                  accessibilityLabel="Settings"
                  accessibilityRole="button"
                >
                  <Settings size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  style={[styles.iconButton, { backgroundColor: withAlpha(colors.card, 0.8) }]}
                  accessibilityLabel="Share video"
                  accessibilityRole="button"
                >
                  <Share2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <TouchableOpacity
                onPress={skipBackward}
                style={[styles.skipButton, { backgroundColor: withAlpha(colors.card, 0.6) }]}
                accessibilityLabel="Skip backward 10 seconds"
                accessibilityRole="button"
              >
                <SkipBack size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
                <Text style={[styles.skipText, { color: colors.text }]}>10</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                style={[styles.playButton, { backgroundColor: withAlpha(colors.primary, 0.9) }]}
                accessibilityLabel={hasEnded ? 'Replay video' : isPlaying ? 'Pause video' : 'Play video'}
                accessibilityRole="button"
                accessibilityState={{ selected: isPlaying }}
              >
                {hasEnded ? (
                  <RotateCcw size={ICON_SIZE['3xl']} color={colors.primaryText} strokeWidth={2} />
                ) : isPlaying ? (
                  <Pause size={ICON_SIZE['3xl']} color={colors.primaryText} fill={colors.primaryText} />
                ) : (
                  <Play size={ICON_SIZE['3xl']} color={colors.primaryText} fill={colors.primaryText} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={skipForward}
                style={[styles.skipButton, { backgroundColor: withAlpha(colors.card, 0.6) }]}
                accessibilityLabel="Skip forward 10 seconds"
                accessibilityRole="button"
              >
                <SkipForward size={ICON_SIZE.xl} color={colors.text} strokeWidth={2} />
                <Text style={[styles.skipText, { color: colors.text }]}>10</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              {/* Video Info */}
              <View style={styles.videoInfo}>
                <Text
                  style={[styles.videoTitle, { color: colors.text }]}
                  numberOfLines={2}
                  accessibilityRole="header"
                >
                  {videoDetails?.title || 'Untitled Video'}
                </Text>
                <View style={styles.videoStats}>
                  <View style={styles.statItem}>
                    <Heart
                      size={ICON_SIZE.sm}
                      color={colors.textMuted}
                      strokeWidth={2}
                    />
                    <Text style={[styles.statText, { color: colors.textMuted }]}>
                      {formatCount(videoDetails?.likes || 0)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Eye
                      size={ICON_SIZE.sm}
                      color={colors.textMuted}
                      strokeWidth={2}
                    />
                    <Text style={[styles.statText, { color: colors.textMuted }]}>
                      {formatCount(videoDetails?.views || 0)} views
                    </Text>
                  </View>
                  {playbackSpeed !== 1 && (
                    <View style={styles.statItem}>
                      <Gauge size={ICON_SIZE.sm} color={colors.primary} strokeWidth={2} />
                      <Text style={[styles.statText, { color: colors.primary }]}>
                        {getSpeedLabel(playbackSpeed)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Text
                  style={[styles.timeText, { color: colors.text }]}
                  accessibilityLabel={`Current time: ${formatDuration(currentTime)}`}
                >
                  {formatDuration(isSeeking ? seekPreviewTime : currentTime)}
                </Text>
                <View style={styles.progressWrapper}>
                  <ProgressBar
                    progress={progress}
                    onSeek={handleSeekEnd}
                    onSeekStart={handleSeekStart}
                    onSeeking={handleSeeking}
                    size="medium"
                    showThumb
                    trackColor={withAlpha(colors.text, 0.3)}
                    fillColor={colors.primary}
                    bufferedProgress={bufferedProgress}
                    bufferedColor={withAlpha(colors.text, 0.5)}
                    accessibilityLabel={`Video progress: ${Math.round(progress * 100)}%`}
                  />
                </View>
                <Text
                  style={[styles.timeText, { color: colors.text }]}
                  accessibilityLabel={`Total duration: ${formatDuration(duration)}`}
                >
                  {formatDuration(duration)}
                </Text>
              </View>

              {/* Action Bar */}
              <View style={styles.actionBar}>
                <TouchableOpacity
                  onPress={toggleMute}
                  style={styles.actionButton}
                  accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isMuted }}
                >
                  {isMuted ? (
                    <VolumeX size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                  ) : (
                    <Volume2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLike}
                  style={styles.actionButton}
                  accessibilityLabel={isLiked ? 'Unlike video' : 'Like video'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isLiked }}
                >
                  <Heart
                    size={ICON_SIZE.lg}
                    color={isLiked ? colors.error : colors.text}
                    fill={isLiked ? colors.error : 'transparent'}
                    strokeWidth={2}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsFullscreen(!isFullscreen)}
                  style={styles.actionButton}
                  accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isFullscreen }}
                >
                  {isFullscreen ? (
                    <Minimize2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                  ) : (
                    <Maximize2 size={ICON_SIZE.lg} color={colors.text} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Settings Menu Overlay */}
          {renderSettingsMenu()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTouchable: {
    flex: 1,
    width: '100%',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  // Double-tap seek indicators
  doubleTapIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doubleTapLeft: {
    left: 0,
    borderTopRightRadius: SCREEN_WIDTH / 2,
    borderBottomRightRadius: SCREEN_WIDTH / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  doubleTapRight: {
    right: 0,
    borderTopLeftRadius: SCREEN_WIDTH / 2,
    borderBottomLeftRadius: SCREEN_WIDTH / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  doubleTapContent: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  doubleTapText: {
    color: '#fff',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Gesture indicators (volume/brightness)
  gestureIndicator: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: 120,
  },
  gestureIndicatorBar: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  gestureIndicatorFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  gestureIndicatorText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  // Seek preview
  seekPreview: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
  },
  seekPreviewTime: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
  },
  // Loading & Error states
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.lg,
    textAlign: 'center',
  },
  errorButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.base,
  },
  errorButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  // Controls overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  iconButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING['2xl'],
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: -SPACING.xs,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    gap: SPACING.md,
  },
  videoInfo: {
    gap: SPACING.xs,
  },
  videoTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.normal,
  },
  videoStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressWrapper: {
    flex: 1,
  },
  timeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    minWidth: 45,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: SPACING.lg,
  },
  actionButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Settings menu
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  settingsBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  settingsContainer: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  settingsTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  settingsItemText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  settingsItemValue: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
});

export const VideoPlayer = memo(VideoPlayerComponent);
export default VideoPlayer;
