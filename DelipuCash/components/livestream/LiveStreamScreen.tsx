/**
 * LiveStreamScreen Component
 * Full-featured live stream/recording screen
 * Design System Compliant - Inspired by TikTok/Instagram/YouTube
 * 
 * Free users: 5 minute max livestream/recording
 * Premium users: Up to 2 hours livestream/recording
 */

import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crown } from 'lucide-react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router, Href } from 'expo-router';
import { CameraView } from 'expo-camera';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, withAlpha } from '@/utils/theme';
import { useCamera } from '@/hooks/useCamera';
import {
  MAX_RECORDING_DURATION,
  MAX_LIVESTREAM_DURATION_PREMIUM,
  formatDuration,
} from '@/utils/video-utils';
import { useVideoPremiumAccess } from '@/services/purchasesHooks';
import { useVideoStore, selectRecordingProgress, selectLivestreamStatus } from '@/store/VideoStore';
import { useStartLivestream, useEndLivestream } from '@/services/hooks';
import { useAuthStore } from '@/utils/auth/store';
import { uploadVideoToR2 } from '@/services/r2UploadService';

// Components
import { CameraControls } from './CameraControls';
import { BottomControls } from './BottomControls';
import { RecordingTimer } from './RecordingTimer';
import { RecordingProgressBar } from './RecordingProgressBar';
import { PermissionPrompt } from './PermissionPrompt';
import { GradientOverlay } from './GradientOverlay';
import { PreLiveLobby } from './PreLiveLobby';
import { StreamHealthBadge } from './StreamHealthBadge';
import { LiveChat } from './LiveChat';

// ============================================================================
// TYPES
// ============================================================================

export interface LiveStreamScreenProps {
  /** Whether screen is visible (for modal usage) */
  visible?: boolean;
  /** Screen mode: 'live' shows pre-live lobby, 'record' goes straight to camera */
  mode?: 'live' | 'record';
  /** Close handler */
  onClose?: () => void;
  /** Video upload completion handler */
  onVideoUploaded?: (videoData: RecordedVideo) => void;
  /** Maximum recording duration in seconds */
  maxDuration?: number;
  /** Whether to show as modal */
  asModal?: boolean;
  /** Callback when user needs to upgrade for extended streaming */
  onUpgradeRequired?: () => void;
}

export interface RecordedVideo {
  id: string;
  uri: string;
  duration: number;
  thumbnailUri?: string;
  title?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const LiveStreamScreen = memo<LiveStreamScreenProps>(({
  visible = true,
  mode = 'record',
  onClose,
  onVideoUploaded,
  maxDuration: propMaxDuration,
  asModal = false,
  onUpgradeRequired,
}) => {
  const { colors } = useTheme();
  const { hasVideoPremium, maxRecordingDuration } = useVideoPremiumAccess();
  const userId = useAuthStore(state => state.auth?.user?.id) ?? null;

  // Video store — selector-based reads only (actions accessed via getState)
  const storeRecordingProgress = useVideoStore(selectRecordingProgress);
  const storeLivestreamStatus = useVideoStore(selectLivestreamStatus);

  // Stable action refs via getState (avoids re-renders from destructuring)
  const storeActions = useVideoStore.getState;
  const storeStartRecording = useCallback(() => storeActions().startRecording(), [storeActions]);
  const storeStopRecording = useCallback(() => storeActions().stopRecording(), [storeActions]);
  const updateRecordingDuration = useCallback((d: number) => storeActions().updateRecordingDuration(d), [storeActions]);
  const storeStartLivestream = useCallback((sid?: string, sk?: string) => storeActions().startLivestream(sid, sk), [storeActions]);
  const storeSetLivestreamLive = useCallback(() => storeActions().setLivestreamLive(), [storeActions]);
  const storeSetLivestreamEnding = useCallback(() => storeActions().setLivestreamEnding(), [storeActions]);
  const storeEndLivestream = useCallback(() => storeActions().endLivestream(), [storeActions]);

  // Derive isRecording from store (single source of truth)
  const isRecording = storeRecordingProgress.isRecording;

  // API hooks for server-side session management
  const startLivestreamMutation = useStartLivestream();
  const endLivestreamMutation = useEndLivestream();

  // Sync premium status with store
  useEffect(() => {
    useVideoStore.getState().setPremiumStatus({
      hasVideoPremium,
      maxUploadSize: hasVideoPremium ? 500 * 1024 * 1024 : 40 * 1024 * 1024,
      maxRecordingDuration: hasVideoPremium ? 1800 : 300,
      maxLivestreamDuration: hasVideoPremium ? 7200 : 300,
    });
  }, [hasVideoPremium]);

  // Use premium limits or prop override
  const effectiveMaxDuration = propMaxDuration ?? (hasVideoPremium ? maxRecordingDuration : MAX_RECORDING_DURATION);
  
  // Refs
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // State
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [showLobby, setShowLobby] = useState(mode === 'live');
  
  // Camera hook - industry standard lazy camera initialization
  // autoRequest: false - Show permission prompt UI first for better UX
  // Only request permissions after user acknowledges why camera is needed
  const {
    hasPermission,
    hasAllPermissions,
    hasMicrophonePermission,
    hasMediaLibraryPermission,
    requestPermissions,
    cameraRef,
    facing,
    torchEnabled,
    toggleFacing,
    toggleTorch,
    zoom,
    setZoom,
    isReady,
    markReady,
    startRecording: cameraStartRecording,
    stopRecording: cameraStopRecording,
    saveToMediaLibrary,
  } = useCamera({
    autoRequest: false, // Industry standard: show permission context first
    pauseOnBackground: true,
    initialFacing: 'back',
    onError: (error) => {
      console.error('[LiveStream] Camera error:', error);
      Alert.alert('Camera Error', error);
    },
  });

  // Sync camera state with local state for UI compatibility
  const isFrontCamera = facing === 'front';
  const isTorchOn = torchEnabled;
  const zoomLevel = zoom;

  // Orientation state for landscape recording support
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLandscape, setIsLandscape] = useState(false);

  // Navigate to subscription screen for upgrade
  const handleUpgrade = useCallback(() => {
    onUpgradeRequired?.();
    router.push('/subscription' as Href);
  }, [onUpgradeRequired]);

  // Cleanup on unmount - stop recording if in progress
  useEffect(() => {
    return () => {
      // Stop recording timer if active
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      // Camera recording cleanup is handled by useCamera hook
    };
  }, []);

  // Handle orientation changes and cleanup
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;

    // Allow landscape orientation when screen is visible
    ScreenOrientation.unlockAsync().catch(() => { });

    // Listen for orientation changes
    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const { orientation } = event.orientationInfo;
      setIsLandscape(
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      );
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      // Reset to portrait when closing
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    };
  }, [visible]);
  
  // Auto-hide controls when recording
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (showControls && !isRecording) {
      timeout = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }, 5000);
    }
    
    return () => clearTimeout(timeout);
  }, [showControls, isRecording, fadeAnim]);
  
  // Recording timer with ref-based stop to avoid circular dependency
  const stopRecordingRef = useRef<(() => void) | null>(null);

  // Recording timer with limit warning and auto-stop
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      setShowLimitWarning(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Sync with store
          updateRecordingDuration(newTime);

          // Show warning 30 seconds before limit (for free users)
          if (!hasVideoPremium && newTime === effectiveMaxDuration - 30) {
            setShowLimitWarning(true);
          }

          // Stop at limit
          if (newTime >= effectiveMaxDuration) {
            stopRecordingRef.current?.();

            // Show upgrade prompt for free users
            if (!hasVideoPremium) {
              Alert.alert(
                'Recording Limit Reached',
                `Free users can record up to ${formatDuration(MAX_RECORDING_DURATION)}. Upgrade to Video Premium for recordings up to ${formatDuration(MAX_LIVESTREAM_DURATION_PREMIUM)}.`,
                [
                  { text: 'Later', style: 'cancel' },
                  {
                    text: 'Upgrade Now',
                    onPress: handleUpgrade,
                  },
                ]
              );
            }

            return effectiveMaxDuration;
          }

          return newTime;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setShowLimitWarning(false);
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording, effectiveMaxDuration, hasVideoPremium, handleUpgrade, updateRecordingDuration]);

  // Handlers - delegating to useCamera hook
  const toggleCamera = useCallback(() => {
    toggleFacing();
  }, [toggleFacing]);
  
  const handleTorchToggle = useCallback(() => {
    toggleTorch();
  }, [toggleTorch]);
  
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(zoom + 0.1, 0.8));
  }, [zoom, setZoom]);
  
  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(zoom - 0.1, 0));
  }, [zoom, setZoom]);
  
  const handleClose = useCallback(() => {
    if (isRecording) {
      Alert.alert(
        'Stop Recording?',
        'Are you sure you want to stop and discard the current recording?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Stop & Exit', 
            style: 'destructive',
            onPress: () => {
              storeStopRecording();
              onClose?.();
            }
          },
        ]
      );
    } else {
      onClose?.();
    }
  }, [isRecording, onClose]);
  
  const toggleControls = useCallback(() => {
    if (!showControls) {
      setShowControls(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showControls, fadeAnim]);
  
  const startRecording = useCallback(async () => {
    // Verify auth before starting
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to start recording.');
      return;
    }

    // Verify all permissions before starting
    if (!hasAllPermissions) {
      Alert.alert(
        'Permissions Required',
        'Camera, microphone, and media library permissions are required to record videos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Permissions', onPress: requestPermissions },
        ]
      );
      return;
    }

    // Update store state
    storeStartRecording();

    // Start server-side livestream session (store enters 'connecting')
    try {
      const response = await startLivestreamMutation.mutateAsync({
        userId,
        title: 'Live Recording',
      });
      sessionIdRef.current = response.sessionId;
      storeStartLivestream(response.sessionId, response.streamKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start session';
      Alert.alert('Connection Error', message, [
        { text: 'Try Again', onPress: startRecording },
        { text: 'Cancel', style: 'cancel' },
      ]);
      storeStopRecording();
      return;
    }

    // Start actual camera recording
    try {
      await cameraStartRecording();
    } catch (error) {
      console.error('Failed to start camera recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      storeStopRecording();
      return;
    }

    // Camera started — transition livestream to 'live'
    storeSetLivestreamLive();
    setShowControls(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [userId, fadeAnim, storeStartRecording, startLivestreamMutation, storeStartLivestream, storeSetLivestreamLive, hasAllPermissions, requestPermissions, cameraStartRecording, storeStopRecording]);
  
  const stopRecording = useCallback(async () => {
    // Transition livestream to 'ending'
    storeSetLivestreamEnding();

    // Stop actual camera recording first
    let videoUri: string | null = null;
    try {
      videoUri = await cameraStopRecording();
    } catch (error) {
      console.error('Failed to stop camera recording:', error);
    }

    // Update store state (recording stopped)
    storeStopRecording();

    // End server-side session
    if (sessionIdRef.current) {
      try {
        await endLivestreamMutation.mutateAsync({
          sessionId: sessionIdRef.current,
          duration: recordingTime,
        });
        storeEndLivestream();
      } catch {
        console.warn('Failed to end server session');
      }
      sessionIdRef.current = null;
    }

    // If we have a recorded video, save to library and upload to R2
    if (videoUri) {
      setIsUploading(true);

      try {
        // Save to media library
        await saveToMediaLibrary(videoUri);

        // Upload to R2 with real progress tracking
        const result = await uploadVideoToR2(
          videoUri,
          userId!,
          {
            title: 'New Recording',
            duration: recordingTime,
          },
          {
            onProgress: (event) => setUploadProgress(event.progress),
          }
        );

        setIsUploading(false);
        setUploadProgress(0);

        if (!result.success) {
          Alert.alert('Upload Error', result.error || 'Failed to upload recording.');
          return;
        }

        const videoData: RecordedVideo = {
          id: result.data?.id || `video_${Date.now()}`,
          uri: videoUri,
          duration: recordingTime,
          title: 'New Recording',
        };

        onVideoUploaded?.(videoData);

        Alert.alert(
          'Recording Saved',
          'Your video has been saved and uploaded successfully!',
          [{ text: 'OK', onPress: onClose }]
        );
      } catch (error) {
        console.error('Failed to save/upload recording:', error);
        setIsUploading(false);
        setUploadProgress(0);
        Alert.alert('Upload Error', error instanceof Error ? error.message : 'Failed to upload recording.');
      }
    } else {
      // No video recorded, just close
      Alert.alert('Recording Error', 'No video was recorded.');
    }
  }, [userId, recordingTime, onVideoUploaded, onClose, storeStopRecording, storeSetLivestreamEnding, endLivestreamMutation, storeEndLivestream, cameraStopRecording, saveToMediaLibrary]);

  // Update ref when stopRecording changes
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);
  
  const handleGoLiveFromLobby = useCallback((title: string) => {
    setShowLobby(false);
    // TODO: Pass title to startRecording when lobby is used
    startRecording();
  }, [startRecording]);

  const handleRecordPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);
  
  const handleMusicPress = useCallback(() => {
    Alert.alert('Music', 'Add music feature coming soon!');
  }, []);
  
  const handleEffectsPress = useCallback(() => {
    Alert.alert('Effects', 'Effects feature coming soon!');
  }, []);
  
  const handleGalleryPress = useCallback(() => {
    Alert.alert('Gallery', 'Import from gallery coming soon!');
  }, []);
  
  const handleFiltersPress = useCallback(() => {
    Alert.alert('Filters', 'Filters feature coming soon!');
  }, []);
  
  const handleSettingsPress = useCallback(() => {
    Alert.alert('Settings', 'Camera settings coming soon!');
  }, []);

  // Permission not yet requested - show context prompt (industry best practice)
  // Users should understand WHY camera access is needed before system dialog
  if (hasPermission === null) {
    return (
      <PermissionPrompt
        type="request"
        onRequestPermissions={requestPermissions}
        title="Enable Camera Access"
        description="To record videos and go live, we need access to your camera, microphone, and media library. Your recordings stay private until you choose to share them."
      />
    );
  }
  
  // Permission denied - show detailed permission status
  if (hasPermission === false || !hasAllPermissions) {
    // Build a descriptive message about which permissions are missing
    const missingPermissions: string[] = [];
    if (!hasPermission) missingPermissions.push('Camera');
    if (!hasMicrophonePermission) missingPermissions.push('Microphone');
    if (!hasMediaLibraryPermission) missingPermissions.push('Media Library');

    const description = missingPermissions.length > 0
      ? `The following permissions are required: ${missingPermissions.join(', ')}. Please grant access to continue.`
      : 'Please grant camera, microphone, and media library access to record videos.';

    return (
      <PermissionPrompt 
        type="request" 
        onRequestPermissions={requestPermissions}
        title="Permissions Required"
        description={description}
      />
    );
  }

  const content = (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <TouchableOpacity 
        activeOpacity={1} 
        style={styles.cameraContainer}
        onPress={toggleControls}
      >
        {/* Real Camera View */}
        <View style={styles.cameraWrapper}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            enableTorch={torchEnabled}
            zoom={zoom}
            onCameraReady={markReady}
            mode="video"
          />

          {/* Loading overlay while camera initializes */}
          {!isReady && (
            <View style={styles.cameraLoadingOverlay}>
              <Text style={styles.cameraLoadingText}>Initializing camera...</Text>
            </View>
          )}

          {/* Pre-Live Lobby (shown when mode='live' and not yet recording) */}
          {showLobby && !isRecording && (
            <PreLiveLobby
              onGoLive={handleGoLiveFromLobby}
              onCancel={onClose || (() => {})}
              maxDuration={effectiveMaxDuration}
              hasVideoPremium={hasVideoPremium}
            />
          )}

          {/* Stream Health Badge */}
          {isRecording && (
            <View style={styles.healthBadgeContainer}>
              <StreamHealthBadge
                status={storeLivestreamStatus.isActive ? 'live' : 'connecting'}
                uploadHealth="good"
              />
            </View>
          )}

          {/* Recording Progress Bar */}
          <RecordingProgressBar
            isRecording={isRecording}
            maxDuration={effectiveMaxDuration * 1000}
          />
          
          {/* Limit Warning Banner */}
          {showLimitWarning && !hasVideoPremium && (
            <View style={[styles.limitWarningBanner, { backgroundColor: withAlpha(colors.warning, 0.95) }]}>
              <Text style={styles.limitWarningText}>
                ⏱️ Recording ends in {formatDuration(effectiveMaxDuration - recordingTime)}
              </Text>
              <TouchableOpacity
                style={[styles.upgradeBannerButton, { backgroundColor: colors.card }]}
                onPress={handleUpgrade}
              >
                <Crown size={14} color={colors.warning} strokeWidth={2} />
                <Text style={[styles.upgradeBannerText, { color: colors.warning }]}>
                  Extend
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gradient Overlays */}
          <GradientOverlay position="top" />
          <GradientOverlay position="bottom" height={200} />
          
          {/* Top Controls */}
          <CameraControls
            isFrontCamera={isFrontCamera}
            onToggleCamera={toggleCamera}
            isTorchOn={isTorchOn}
            onToggleTorch={handleTorchToggle}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onClose={handleClose}
            onSettings={handleSettingsPress}
            fadeAnim={fadeAnim}
            visible={showControls}
            isRecording={isRecording}
          />
          
          {/* Recording Timer */}
          <RecordingTimer
            currentTime={recordingTime}
            maxDuration={effectiveMaxDuration}
            isRecording={isRecording}
          />
          
          {/* Live Chat Overlay (only in live mode while recording) */}
          {mode === 'live' && isRecording && storeLivestreamStatus.sessionId && (
            <LiveChat
              sessionId={storeLivestreamStatus.sessionId}
              inputEnabled={true}
            />
          )}

          {/* Bottom Controls */}
          <BottomControls
            isRecording={isRecording}
            isUploading={isUploading}
            onRecordPress={handleRecordPress}
            onMusicPress={handleMusicPress}
            onEffectsPress={handleEffectsPress}
            onGalleryPress={handleGalleryPress}
            onFiltersPress={handleFiltersPress}
            fadeAnim={fadeAnim}
            visible={showControls}
            uploadProgress={uploadProgress}
            maxDuration={effectiveMaxDuration}
            hasVideoPremium={hasVideoPremium}
          />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );

  if (asModal) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        {content}
      </Modal>
    );
  }

  return visible ? content : null;
});

LiveStreamScreen.displayName = 'LiveStreamScreen';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'black',
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraWrapper: {
    flex: 1,
    backgroundColor: '#000', // Black background while camera loads
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  cameraLoadingText: {
    color: '#fff',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  limitWarningBanner: {
    position: 'absolute',
    top: 60,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    zIndex: 100,
  },
  limitWarningText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: '#000',
  },
  upgradeBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  upgradeBannerText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  healthBadgeContainer: {
    position: 'absolute',
    top: 80,
    left: SPACING.lg,
    zIndex: 90,
  },
});

export default LiveStreamScreen;
