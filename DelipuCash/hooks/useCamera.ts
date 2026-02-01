/**
 * useCamera Hook - Industry Standard Camera Initialization
 * 
 * Following best practices:
 * - Lazy initialization (only request permissions when needed)
 * - Proper cleanup on unmount
 * - Error boundary friendly
 * - Platform-aware (handles web gracefully)
 * - Memory-efficient (doesn't keep camera active when not visible)
 * 
 * @example
 * ```tsx
 * const { 
 *   hasPermission, 
 *   isReady, 
 *   requestPermissions,
 *   cameraRef 
 * } = useCamera({ autoRequest: false });
 * ```
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

// ============================================================================
// TYPES
// ============================================================================

export interface CameraState {
  /** Whether camera permissions have been granted */
  hasPermission: boolean | null;
  /** Whether microphone permissions have been granted */
  hasMicrophonePermission: boolean | null;
  /** Whether media library permissions have been granted */
  hasMediaLibraryPermission: boolean | null;
  /** Whether all required permissions are granted */
  hasAllPermissions: boolean;
  /** Whether camera is ready to use */
  isReady: boolean;
  /** Whether camera is currently active/mounted */
  isActive: boolean;
  /** Current camera facing (front/back) */
  facing: CameraType;
  /** Whether torch/flash is enabled */
  torchEnabled: boolean;
  /** Current zoom level (0-1) */
  zoom: number;
  /** Any error that occurred */
  error: string | null;
  /** Whether permissions are being requested */
  isRequestingPermission: boolean;
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Recording output URI */
  recordingUri: string | null;
}

export interface UseCameraOptions {
  /** Auto-request permissions on mount */
  autoRequest?: boolean;
  /** Initial camera facing */
  initialFacing?: CameraType;
  /** Whether to pause camera when app goes to background */
  pauseOnBackground?: boolean;
  /** Callback when permission status changes */
  onPermissionChange?: (granted: boolean) => void;
  /** Callback when camera becomes ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

export interface UseCameraReturn extends CameraState {
  /** Request camera permissions */
  requestPermissions: () => Promise<boolean>;
  /** Toggle camera facing (front/back) */
  toggleFacing: () => void;
  /** Set camera facing */
  setFacing: (facing: CameraType) => void;
  /** Toggle torch on/off */
  toggleTorch: () => void;
  /** Set torch state */
  setTorchEnabled: (enabled: boolean) => void;
  /** Set zoom level (0-1) */
  setZoom: (zoom: number) => void;
  /** Ref for CameraView component */
  cameraRef: React.RefObject<CameraView | null>;
  /** Mark camera as ready (call from CameraView onCameraReady) */
  markReady: () => void;
  /** Pause camera (saves resources) */
  pause: () => void;
  /** Resume camera */
  resume: () => void;
  /** Start video recording */
  startRecording: () => Promise<void>;
  /** Stop video recording */
  stopRecording: () => Promise<string | null>;
  /** Save recording to media library */
  saveToMediaLibrary: (uri: string) => Promise<string | null>;
  /** Reset camera state */
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  // Memoize options to prevent dependency array issues
  const opts = useMemo(() => ({
    autoRequest: options.autoRequest ?? false,
    initialFacing: options.initialFacing ?? 'back' as CameraType,
    pauseOnBackground: options.pauseOnBackground ?? true,
    onPermissionChange: options.onPermissionChange ?? (() => {}),
    onReady: options.onReady ?? (() => {}),
    onError: options.onError ?? (() => {}),
  }), [
    options.autoRequest,
    options.initialFacing,
    options.pauseOnBackground,
    options.onPermissionChange,
    options.onReady,
    options.onError,
  ]);
  
  // Use expo-camera's built-in permission hooks
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  
  // Camera ref
  const cameraRef = useRef<CameraView | null>(null);
  
  // Recording ref to track recording state
  const isRecordingRef = useRef(false);

  // State
  const [state, setState] = useState<CameraState>(() => ({
    hasPermission: null,
    hasMicrophonePermission: null,
    hasMediaLibraryPermission: null,
    hasAllPermissions: false,
    isReady: false,
    isActive: true,
    facing: opts.initialFacing,
    torchEnabled: false,
    zoom: 0,
    error: null,
    isRequestingPermission: false,
    isRecording: false,
    recordingUri: null,
  }));
  
  // Track if component is mounted
  const isMountedRef = useRef(true);
  
  // ============================================================================
  // PERMISSION HANDLING
  // ============================================================================

  // Request all permissions (camera, microphone, media library) - industry standard
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Web doesn't support camera in the same way
    if (Platform.OS === 'web') {
      setState(prev => ({ 
        ...prev, 
        hasPermission: false,
        hasAllPermissions: false,
        error: 'Camera not supported on web' 
      }));
      return false;
    }
    
    setState(prev => ({ ...prev, isRequestingPermission: true, error: null }));
    
    try {
      // Request all permissions in parallel for better UX
      const [cameraResult, micResult, mediaResult] = await Promise.all([
        requestCameraPermission(),
        requestMicrophonePermission(),
        requestMediaLibraryPermission(),
      ]);

      const cameraGranted = cameraResult?.granted ?? false;
      const micGranted = micResult?.granted ?? false;
      const mediaGranted = mediaResult?.granted ?? false;
      const allGranted = cameraGranted && micGranted && mediaGranted;
      
      if (isMountedRef.current) {
        let errorMessage: string | null = null;
        if (!cameraGranted) errorMessage = 'Camera permission denied';
        else if (!micGranted) errorMessage = 'Microphone permission denied';
        else if (!mediaGranted) errorMessage = 'Media library permission denied';

        setState(prev => ({ 
          ...prev, 
          hasPermission: cameraGranted,
          hasMicrophonePermission: micGranted,
          hasMediaLibraryPermission: mediaGranted,
          hasAllPermissions: allGranted,
          isRequestingPermission: false,
          error: errorMessage,
        }));
        
        opts.onPermissionChange(allGranted);
      }
      
      return allGranted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permissions';
      
      if (isMountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          hasPermission: false,
          hasMicrophonePermission: false,
          hasMediaLibraryPermission: false,
          hasAllPermissions: false,
          isRequestingPermission: false,
          error: errorMessage,
        }));
        
        opts.onError(errorMessage);
      }
      
      return false;
    }
  }, [requestCameraPermission, requestMicrophonePermission, requestMediaLibraryPermission, opts]);
  
  // Sync permission state from expo-camera hooks
  useEffect(() => {
    const cameraGranted = cameraPermission?.granted ?? null;
    const micGranted = microphonePermission?.granted ?? null;
    const mediaGranted = mediaLibraryPermission?.granted ?? null;
    const allGranted = (cameraGranted && micGranted && mediaGranted) ?? false;

    if (cameraGranted !== state.hasPermission ||
      micGranted !== state.hasMicrophonePermission ||
      mediaGranted !== state.hasMediaLibraryPermission) {
      setState(prev => ({
        ...prev,
        hasPermission: cameraGranted,
        hasMicrophonePermission: micGranted,
        hasMediaLibraryPermission: mediaGranted,
        hasAllPermissions: allGranted,
      }));

      if (cameraGranted !== null) {
        opts.onPermissionChange(allGranted);
      }
    }
  }, [cameraPermission?.granted, microphonePermission?.granted, mediaLibraryPermission?.granted, state.hasPermission, state.hasMicrophonePermission, state.hasMediaLibraryPermission, opts]);
  
  // Auto-request permissions if enabled
  useEffect(() => {
    if (opts.autoRequest && state.hasPermission === null && !state.isRequestingPermission) {
      requestPermissions();
    }
  }, [opts.autoRequest, state.hasPermission, state.isRequestingPermission, requestPermissions]);
  
  // ============================================================================
  // APP STATE HANDLING (Background/Foreground)
  // ============================================================================
  
  useEffect(() => {
    if (!opts.pauseOnBackground) return;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (isMountedRef.current) {
        if (nextAppState === 'active') {
          setState(prev => ({ ...prev, isActive: true }));
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          setState(prev => ({ ...prev, isActive: false }));
        }
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [opts.pauseOnBackground]);
  
  // ============================================================================
  // CAMERA CONTROLS
  // ============================================================================
  
  const toggleFacing = useCallback(() => {
    setState(prev => ({
      ...prev,
      facing: prev.facing === 'back' ? 'front' : 'back',
      // Disable torch when switching to front camera
      torchEnabled: prev.facing === 'back' ? false : prev.torchEnabled,
    }));
  }, []);
  
  const setFacing = useCallback((facing: CameraType) => {
    setState(prev => ({
      ...prev,
      facing,
      // Disable torch when switching to front camera
      torchEnabled: facing === 'front' ? false : prev.torchEnabled,
    }));
  }, []);
  
  const toggleTorch = useCallback(() => {
    setState(prev => {
      // Torch only works on back camera
      if (prev.facing === 'front') {
        return prev;
      }
      return { ...prev, torchEnabled: !prev.torchEnabled };
    });
  }, []);
  
  const setTorchEnabled = useCallback((enabled: boolean) => {
    setState(prev => {
      // Torch only works on back camera
      if (prev.facing === 'front') {
        return prev;
      }
      return { ...prev, torchEnabled: enabled };
    });
  }, []);
  
  const setZoom = useCallback((zoom: number) => {
    // Clamp zoom between 0 and 1
    const clampedZoom = Math.max(0, Math.min(1, zoom));
    setState(prev => ({ ...prev, zoom: clampedZoom }));
  }, []);
  
  const markReady = useCallback(() => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, isReady: true }));
      opts.onReady();
    }
  }, [opts]);
  
  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false }));
  }, []);
  
  const resume = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
  }, []);
  
  const reset = useCallback(() => {
    setState({
      hasPermission: cameraPermission?.granted ?? null,
      hasMicrophonePermission: microphonePermission?.granted ?? null,
      hasMediaLibraryPermission: mediaLibraryPermission?.granted ?? null,
      hasAllPermissions: (cameraPermission?.granted && microphonePermission?.granted && mediaLibraryPermission?.granted) ?? false,
      isReady: false,
      isActive: true,
      facing: opts.initialFacing,
      torchEnabled: false,
      zoom: 0,
      error: null,
      isRequestingPermission: false,
      isRecording: false,
      recordingUri: null,
    });
  }, [cameraPermission, microphonePermission, mediaLibraryPermission, opts.initialFacing]);

  // ============================================================================
  // VIDEO RECORDING - Industry Standard Implementation
  // ============================================================================

  /**
   * Start video recording
   * Requires camera and microphone permissions to be granted
   */
  const startRecording = useCallback(async (): Promise<void> => {
    if (!cameraRef.current) {
      setState(prev => ({ ...prev, error: 'Camera not ready' }));
      opts.onError('Camera not ready');
      return;
    }

    if (!state.hasAllPermissions) {
      setState(prev => ({ ...prev, error: 'Permissions not granted' }));
      opts.onError('Camera, microphone, or media library permissions not granted');
      return;
    }

    if (isRecordingRef.current) {
      console.warn('[useCamera] Already recording');
      return;
    }

    try {
      isRecordingRef.current = true;
      setState(prev => ({ ...prev, isRecording: true, error: null, recordingUri: null }));

      // Start recording - expo-camera will handle audio recording automatically
      // when microphone permission is granted
      const video = await cameraRef.current.recordAsync({
        maxDuration: 3600, // 1 hour max (will be limited by app logic)
      });

      if (isMountedRef.current && video?.uri) {
        setState(prev => ({
          ...prev,
          isRecording: false,
          recordingUri: video.uri
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          isRecording: false,
          error: errorMessage
        }));
        opts.onError(errorMessage);
      }
    } finally {
      isRecordingRef.current = false;
    }
  }, [state.hasAllPermissions, opts]);

  /**
   * Stop video recording
   * Returns the URI of the recorded video, or null if no recording was in progress
   */
  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!cameraRef.current) {
      return null;
    }

    if (!isRecordingRef.current) {
      console.warn('[useCamera] Not currently recording');
      return null;
    }

    try {
      cameraRef.current.stopRecording();

      // Wait for recording to complete and state to update
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isRecordingRef.current || state.recordingUri) {
            clearInterval(checkInterval);
            resolve(state.recordingUri);
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(state.recordingUri);
        }, 5000);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';

      if (isMountedRef.current) {
        setState(prev => ({ ...prev, error: errorMessage }));
        opts.onError(errorMessage);
      }

      return null;
    }
  }, [state.recordingUri, opts]);

  /**
   * Save recording to device media library
   * Returns the asset URI if successful, null otherwise
   */
  const saveToMediaLibrary = useCallback(async (uri: string): Promise<string | null> => {
    if (!state.hasMediaLibraryPermission) {
      setState(prev => ({ ...prev, error: 'Media library permission not granted' }));
      opts.onError('Media library permission not granted');
      return null;
    }

    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      return asset.uri;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save to media library';

      if (isMountedRef.current) {
        setState(prev => ({ ...prev, error: errorMessage }));
        opts.onError(errorMessage);
      }

      return null;
    }
  }, [state.hasMediaLibraryPermission, opts]);
  
  // ============================================================================
  // CLEANUP - Stop recording on unmount to prevent orphaned recordings
  // ============================================================================
  
  useEffect(() => {
    isMountedRef.current = true;
    // Capture ref value for cleanup
    const camera = cameraRef.current;
    
    return () => {
      isMountedRef.current = false;

      // Stop recording if in progress when component unmounts
      if (isRecordingRef.current && camera) {
        try {
          camera.stopRecording();
        } catch {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    ...state,
    requestPermissions,
    toggleFacing,
    setFacing,
    toggleTorch,
    setTorchEnabled,
    setZoom,
    cameraRef,
    markReady,
    pause,
    resume,
    startRecording,
    stopRecording,
    saveToMediaLibrary,
    reset,
  };
}

// ============================================================================
// UTILITY: Check Camera Availability
// ============================================================================

/**
 * Check if camera is available on this device
 * Useful for conditional rendering
 */
export async function isCameraAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  
  try {
    // Check if we can at least get camera permissions status
    // This is a simpler check that works across expo-camera versions
    const { Camera } = await import('expo-camera');
    const permissionResult = await Camera.getCameraPermissionsAsync();
    // If we can query permissions, camera API is available
    return permissionResult !== undefined;
  } catch {
    return false;
  }
}

export default useCamera;
