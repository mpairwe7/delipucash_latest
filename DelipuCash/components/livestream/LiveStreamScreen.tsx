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

// Components
import { CameraControls } from './CameraControls';
import { BottomControls } from './BottomControls';
import { RecordingTimer } from './RecordingTimer';
import { RecordingProgressBar } from './RecordingProgressBar';
import { PermissionPrompt } from './PermissionPrompt';
import { GradientOverlay } from './GradientOverlay';

// ============================================================================
// TYPES
// ============================================================================

export interface LiveStreamScreenProps {
  /** Whether screen is visible (for modal usage) */
  visible?: boolean;
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
  onClose,
  onVideoUploaded,
  maxDuration: propMaxDuration,
  asModal = false,
  onUpgradeRequired,
}) => {
  const { colors } = useTheme();
  const { hasVideoPremium, maxRecordingDuration } = useVideoPremiumAccess();

  // Video store for state management (selectors available for UI display if needed)
  const storeRecordingProgress = useVideoStore(selectRecordingProgress);
  const storeLivestreamStatus = useVideoStore(selectLivestreamStatus);
  const { 
    startRecording: storeStartRecording, 
    stopRecording: storeStopRecording,
    updateRecordingDuration,
    startLivestream: storeStartLivestream,
    endLivestream: storeEndLivestream,
    setPremiumStatus,
  } = useVideoStore();

  // Use store state for display (exposed for parent components if needed)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isStoreRecording = storeRecordingProgress.isRecording;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isStoreLive = storeLivestreamStatus.isActive;

  // API hooks for server-side session management
  const startLivestreamMutation = useStartLivestream();
  const endLivestreamMutation = useEndLivestream();

  // Sync premium status with store
  useEffect(() => {
    setPremiumStatus({
      hasVideoPremium,
      maxUploadSize: hasVideoPremium ? 500 * 1024 * 1024 : 20 * 1024 * 1024,
      maxRecordingDuration: hasVideoPremium ? 1800 : 300,
      maxLivestreamDuration: hasVideoPremium ? 7200 : 300,
    });
  }, [hasVideoPremium, setPremiumStatus]);

  // Use premium limits or prop override
  const effectiveMaxDuration = propMaxDuration ?? (hasVideoPremium ? maxRecordingDuration : MAX_RECORDING_DURATION);
  
  // Refs
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  
  // Camera hook - industry standard camera initialization
  const {
    hasPermission,
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
  } = useCamera({
    autoRequest: true,
    pauseOnBackground: true,
    initialFacing: 'back',
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
              setIsRecording(false);
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
    // Update store state
    storeStartRecording();
    
    // Start server-side livestream session
    try {
      const response = await startLivestreamMutation.mutateAsync({
        userId: 'current-user', // TODO: Get actual user ID from auth context
        title: 'Live Recording',
      });
      sessionIdRef.current = response.sessionId;
      storeStartLivestream(response.sessionId);
    } catch {
      console.warn('Failed to start server session, continuing locally');
    }

    setIsRecording(true);
    setShowControls(true);
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, storeStartRecording, startLivestreamMutation, storeStartLivestream]);
  
  const stopRecording = useCallback(async () => {
    // Update store state
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

    setIsRecording(false);
    setIsUploading(true);
    
    // Simulate upload with progress
    let progress = 0;
    const uploadInterval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(uploadInterval);
        
        // Simulate upload completion
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          
          const videoData: RecordedVideo = {
            id: `video_${Date.now()}`,
            uri: `https://storage.delipucash.com/videos/${Date.now()}.mp4`,
            duration: recordingTime,
            title: 'New Recording',
          };
          
          onVideoUploaded?.(videoData);
          
          Alert.alert(
            'Upload Complete',
            'Your video has been uploaded successfully!',
            [{ text: 'OK', onPress: onClose }]
          );
        }, 500);
      }
      setUploadProgress(Math.min(Math.round(progress), 100));
    }, 200);
  }, [recordingTime, onVideoUploaded, onClose, storeStopRecording, endLivestreamMutation, storeEndLivestream]);

  // Update ref when stopRecording changes
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);
  
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

  // Loading state
  if (hasPermission === null) {
    return <PermissionPrompt type="loading" />;
  }
  
  // Permission denied
  if (hasPermission === false) {
    return (
      <PermissionPrompt 
        type="request" 
        onRequestPermissions={requestPermissions}
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
});

export default LiveStreamScreen;
