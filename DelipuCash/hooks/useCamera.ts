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
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

// ============================================================================
// TYPES
// ============================================================================

export interface CameraState {
  /** Whether camera permissions have been granted */
  hasPermission: boolean | null;
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
  
  // Use expo-camera's built-in permission hook
  const [permission, requestPermission] = useCameraPermissions();
  
  // Camera ref
  const cameraRef = useRef<CameraView | null>(null);
  
  // State
  const [state, setState] = useState<CameraState>(() => ({
    hasPermission: null,
    isReady: false,
    isActive: true,
    facing: opts.initialFacing,
    torchEnabled: false,
    zoom: 0,
    error: null,
    isRequestingPermission: false,
  }));
  
  // Track if component is mounted
  const isMountedRef = useRef(true);
  
  // ============================================================================
  // PERMISSION HANDLING
  // ============================================================================
  
  // Request permissions - defined before use in effects
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    // Web doesn't support camera in the same way
    if (Platform.OS === 'web') {
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        error: 'Camera not supported on web' 
      }));
      return false;
    }
    
    setState(prev => ({ ...prev, isRequestingPermission: true, error: null }));
    
    try {
      const result = await requestPermission();
      const granted = result?.granted ?? false;
      
      if (isMountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          hasPermission: granted,
          isRequestingPermission: false,
          error: granted ? null : 'Camera permission denied',
        }));
        
        opts.onPermissionChange(granted);
      }
      
      return granted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request camera permission';
      
      if (isMountedRef.current) {
        setState(prev => ({ 
          ...prev, 
          hasPermission: false,
          isRequestingPermission: false,
          error: errorMessage,
        }));
        
        opts.onError(errorMessage);
      }
      
      return false;
    }
  }, [requestPermission, opts]);
  
  // Sync permission state from expo-camera hook
  useEffect(() => {
    if (permission !== undefined) {
      const granted = permission?.granted ?? null;
      
      if (granted !== state.hasPermission) {
        setState(prev => ({ ...prev, hasPermission: granted }));
        
        if (granted !== null) {
          opts.onPermissionChange(granted);
        }
      }
    }
  }, [permission, state.hasPermission, opts]);
  
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
      hasPermission: permission?.granted ?? null,
      isReady: false,
      isActive: true,
      facing: opts.initialFacing,
      torchEnabled: false,
      zoom: 0,
      error: null,
      isRequestingPermission: false,
    });
  }, [permission, opts.initialFacing]);
  
  // ============================================================================
  // CLEANUP
  // ============================================================================
  
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
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
