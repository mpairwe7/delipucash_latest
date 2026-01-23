/**
 * Screen Orientation Hook
 * Provides screen orientation management across the app
 * 
 * Features:
 * - Lock/unlock orientation
 * - Listen to orientation changes
 * - Utility functions for common patterns
 * 
 * @example
 * ```tsx
 * const { lockToLandscape, lockToPortrait, unlock } = useScreenOrientation();
 * 
 * // Lock to landscape for video playback
 * await lockToLandscape();
 * 
 * // Return to portrait
 * await lockToPortrait();
 * ```
 */

import { useCallback, useEffect, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

/**
 * Orientation type for simplified usage
 */
export type OrientationType = 'portrait' | 'landscape' | 'unknown';

/**
 * Hook return type
 */
export interface UseScreenOrientationReturn {
  /** Current orientation type */
  orientation: OrientationType;
  /** Whether device is in landscape mode */
  isLandscape: boolean;
  /** Whether device is in portrait mode */
  isPortrait: boolean;
  /** Lock screen to portrait orientation */
  lockToPortrait: () => Promise<void>;
  /** Lock screen to landscape orientation */
  lockToLandscape: () => Promise<void>;
  /** Lock screen to landscape left */
  lockToLandscapeLeft: () => Promise<void>;
  /** Lock screen to landscape right */
  lockToLandscapeRight: () => Promise<void>;
  /** Unlock screen orientation (allow all) */
  unlock: () => Promise<void>;
  /** Get the current orientation lock */
  getOrientationLock: () => Promise<ScreenOrientation.OrientationLock>;
}

/**
 * Convert ScreenOrientation.Orientation to simplified type
 */
const getOrientationType = (orientation: ScreenOrientation.Orientation): OrientationType => {
  switch (orientation) {
    case ScreenOrientation.Orientation.PORTRAIT_UP:
    case ScreenOrientation.Orientation.PORTRAIT_DOWN:
      return 'portrait';
    case ScreenOrientation.Orientation.LANDSCAPE_LEFT:
    case ScreenOrientation.Orientation.LANDSCAPE_RIGHT:
      return 'landscape';
    default:
      return 'unknown';
  }
};

/**
 * Screen Orientation Hook
 * Manages screen orientation state and provides control functions
 */
export function useScreenOrientation(): UseScreenOrientationReturn {
  const [orientation, setOrientation] = useState<OrientationType>('portrait');

  // Subscribe to orientation changes
  useEffect(() => {
    // Web doesn't support orientation changes the same way
    if (Platform.OS === 'web') {
      return;
    }

    let subscription: ScreenOrientation.Subscription | null = null;

    const initOrientation = async () => {
      try {
        // Get initial orientation
        const currentOrientation = await ScreenOrientation.getOrientationAsync();
        setOrientation(getOrientationType(currentOrientation));

        // Subscribe to changes
        subscription = ScreenOrientation.addOrientationChangeListener((event) => {
          setOrientation(getOrientationType(event.orientationInfo.orientation));
        });
      } catch (error) {
        console.warn('Failed to initialize orientation:', error);
      }
    };

    initOrientation();

    return () => {
      if (subscription) {
        ScreenOrientation.removeOrientationChangeListener(subscription);
      }
    };
  }, []);

  // Lock to portrait
  const lockToPortrait = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (error) {
      console.warn('Failed to lock to portrait:', error);
    }
  }, []);

  // Lock to landscape (any direction)
  const lockToLandscape = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (error) {
      console.warn('Failed to lock to landscape:', error);
    }
  }, []);

  // Lock to landscape left
  const lockToLandscapeLeft = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT);
    } catch (error) {
      console.warn('Failed to lock to landscape left:', error);
    }
  }, []);

  // Lock to landscape right
  const lockToLandscapeRight = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    } catch (error) {
      console.warn('Failed to lock to landscape right:', error);
    }
  }, []);

  // Unlock orientation (allow all)
  const unlock = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await ScreenOrientation.unlockAsync();
    } catch (error) {
      console.warn('Failed to unlock orientation:', error);
    }
  }, []);

  // Get current orientation lock
  const getOrientationLock = useCallback(async () => {
    if (Platform.OS === 'web') {
      return ScreenOrientation.OrientationLock.DEFAULT;
    }
    try {
      return await ScreenOrientation.getOrientationLockAsync();
    } catch (error) {
      console.warn('Failed to get orientation lock:', error);
      return ScreenOrientation.OrientationLock.DEFAULT;
    }
  }, []);

  return {
    orientation,
    isLandscape: orientation === 'landscape',
    isPortrait: orientation === 'portrait',
    lockToPortrait,
    lockToLandscape,
    lockToLandscapeLeft,
    lockToLandscapeRight,
    unlock,
    getOrientationLock,
  };
}

/**
 * Lock orientation to portrait for the current screen
 * Use this at component mount to ensure portrait mode
 */
export async function lockPortrait(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (error) {
    console.warn('Failed to lock portrait:', error);
  }
}

/**
 * Lock orientation to landscape for the current screen
 * Use this for video players or media viewers
 */
export async function lockLandscape(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch (error) {
    console.warn('Failed to lock landscape:', error);
  }
}

/**
 * Unlock orientation to allow all orientations
 */
export async function unlockOrientation(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await ScreenOrientation.unlockAsync();
  } catch (error) {
    console.warn('Failed to unlock orientation:', error);
  }
}

export default useScreenOrientation;
