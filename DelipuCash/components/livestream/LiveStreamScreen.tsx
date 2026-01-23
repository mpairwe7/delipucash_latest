/**
 * LiveStreamScreen Component
 * Full-featured live stream/recording screen
 * Design System Compliant - Inspired by TikTok/Instagram/YouTube
 */

import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  StatusBar,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useTheme } from '@/utils/theme';
import { MAX_RECORDING_DURATION } from '@/utils/video-utils';

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
}

export interface RecordedVideo {
  id: string;
  uri: string;
  duration: number;
  thumbnailUri?: string;
  title?: string;
}

// Mock camera permissions for demo
const useMockCameraPermissions = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Simulate permission check
    setTimeout(() => setHasPermission(true), 500);
  }, []);
  
  return {
    hasPermission,
    requestPermissions: () => setHasPermission(true),
  };
};

// ============================================================================
// COMPONENT
// ============================================================================

export const LiveStreamScreen = memo<LiveStreamScreenProps>(({
  visible = true,
  onClose,
  onVideoUploaded,
  maxDuration = MAX_RECORDING_DURATION,
  asModal = false,
}) => {
  useTheme(); // For theme context
  
  // Refs
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // State
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Permissions (mock for demo)
  const { hasPermission, requestPermissions } = useMockCameraPermissions();

  // Orientation state for landscape recording support
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLandscape, setIsLandscape] = useState(false);

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

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            // Use ref to call stopRecording
            stopRecordingRef.current?.();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording, maxDuration]);

  // Handlers
  const toggleCamera = useCallback(() => {
    setIsFrontCamera(prev => !prev);
  }, []);
  
  const toggleTorch = useCallback(() => {
    setIsTorchOn(prev => !prev);
  }, []);
  
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 0.8));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0));
  }, []);
  
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
    setIsRecording(true);
    setShowControls(true);
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);
  
  const stopRecording = useCallback(async () => {
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
  }, [recordingTime, onVideoUploaded, onClose]);

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
        {/* Mock Camera View */}
        <View style={styles.mockCamera}>
          {/* Recording Progress Bar */}
          <RecordingProgressBar
            isRecording={isRecording}
            maxDuration={maxDuration * 1000}
          />
          
          {/* Gradient Overlays */}
          <GradientOverlay position="top" />
          <GradientOverlay position="bottom" height={200} />
          
          {/* Top Controls */}
          <CameraControls
            isFrontCamera={isFrontCamera}
            onToggleCamera={toggleCamera}
            isTorchOn={isTorchOn}
            onToggleTorch={toggleTorch}
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
            maxDuration={maxDuration}
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
  mockCamera: {
    flex: 1,
    backgroundColor: '#1a1a2e', // Dark background to simulate camera
  },
});

export default LiveStreamScreen;
