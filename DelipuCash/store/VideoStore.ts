/**
 * Video Store - State Management for Video Features
 * Zustand-based store for managing video upload, livestream, and premium state
 * Design System Compliant - Consistent with app architecture
 * 
 * Architecture:
 * - Zustand: Client-side UI state (upload progress, recording state, limits)
 * - TanStack Query: Server state (data fetching, caching, sync)
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Free user upload limit: 40MB */
export const FREE_UPLOAD_LIMIT_BYTES = 40 * 1024 * 1024;

/** Premium user upload limit: 500MB */
export const PREMIUM_UPLOAD_LIMIT_BYTES = 500 * 1024 * 1024;

/** Free user livestream/recording limit: 5 minutes */
export const FREE_LIVESTREAM_LIMIT_SECONDS = 300;

/** Premium user livestream limit: 2 hours */
export const PREMIUM_LIVESTREAM_LIMIT_SECONDS = 7200;

/** Premium user recording limit: 30 minutes */
export const PREMIUM_RECORDING_LIMIT_SECONDS = 1800;

// ============================================================================
// TYPES
// ============================================================================

export type UploadStatus = 'idle' | 'selecting' | 'validating' | 'uploading' | 'processing' | 'completed' | 'error';
export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'paused' | 'stopping' | 'processing' | 'completed' | 'error';
export type LivestreamStatus = 'idle' | 'connecting' | 'live' | 'paused' | 'ending' | 'ended' | 'error';

export interface VideoUploadProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number; // 0-100
  status: UploadStatus;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface RecordingSession {
  sessionId: string;
  startedAt: string;
  duration: number; // seconds
  maxDuration: number; // seconds
  status: RecordingStatus;
  isFrontCamera: boolean;
  isTorchOn: boolean;
  zoomLevel: number;
  outputUri?: string;
  thumbnailUri?: string;
  error?: string;
}

export interface LivestreamSession {
  sessionId: string;
  streamKey?: string;
  startedAt: string;
  duration: number; // seconds
  maxDuration: number; // seconds
  status: LivestreamStatus;
  viewerCount: number;
  peakViewers: number;
  error?: string;
}

export interface VideoPremiumStatus {
  hasVideoPremium: boolean;
  maxUploadSize: number;
  maxRecordingDuration: number;
  maxLivestreamDuration: number;
  expiresAt?: string;
  productId?: string;
}

export interface VideoLimitsWarning {
  type: 'upload_size' | 'recording_duration' | 'livestream_duration';
  message: string;
  currentValue: number;
  limitValue: number;
  isPremiumRequired: boolean;
  dismissedAt?: string;
}

/** Trending video slider state */
export interface TrendingSliderState {
  activeIndex: number;
  isAutoScrolling: boolean;
  lastInteractionAt: string | null;
}

/** Video player state for global control */
export interface VideoPlayerState {
  currentVideoId: string | null;
  isPlaying: boolean;
  isMuted: boolean;
  progress: number;
  duration: number;
  isFullscreen: boolean;
  playbackSpeed: number;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
}

/** Watch history entry */
export interface WatchHistoryEntry {
  videoId: string;
  watchedAt: string;
  progressPercent: number;
  duration: number;
}

export interface VideoState {
  // Premium status (synced from backend/RevenueCat)
  premiumStatus: VideoPremiumStatus;
  
  // Upload state
  currentUpload: VideoUploadProgress | null;
  uploadHistory: VideoUploadProgress[];
  
  // Recording state
  currentRecording: RecordingSession | null;
  recordingHistory: RecordingSession[];
  
  // Livestream state
  currentLivestream: LivestreamSession | null;
  livestreamHistory: LivestreamSession[];
  
  // Trending slider state
  trendingSlider: TrendingSliderState;

  // Video player state
  player: VideoPlayerState;

  // Watch history
  watchHistory: WatchHistoryEntry[];

  // Video queue for auto-play
  videoQueue: string[];

  // Liked videos (local cache)
  likedVideoIds: string[];

  // Warnings & prompts
  activeWarning: VideoLimitsWarning | null;
  showUpgradePrompt: boolean;
  
  // UI state
  isUploadModalVisible: boolean;
  isLivestreamModalVisible: boolean;
  
  // Error handling
  lastError: string | null;
}

export interface VideoActions {
  // Premium status
  setPremiumStatus: (status: VideoPremiumStatus) => void;
  refreshPremiumStatus: () => void;
  
  // Upload management
  startUpload: (file: { name: string; size: number; uri: string }) => VideoUploadProgress | null;
  updateUploadProgress: (fileId: string, progress: Partial<VideoUploadProgress>) => void;
  cancelUpload: (fileId: string) => void;
  completeUpload: (fileId: string, videoUrl: string) => void;
  failUpload: (fileId: string, error: string) => void;
  clearUploadHistory: () => void;
  
  // Recording management
  startRecording: (options?: { isFrontCamera?: boolean }) => RecordingSession;
  updateRecordingDuration: (duration: number) => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: (outputUri?: string) => void;
  failRecording: (error: string) => void;
  
  // Livestream management
  startLivestream: (streamKey?: string) => LivestreamSession;
  updateLivestreamDuration: (duration: number) => void;
  updateViewerCount: (count: number) => void;
  endLivestream: () => void;
  failLivestream: (error: string) => void;
  
  // Warnings & prompts
  showWarning: (warning: VideoLimitsWarning) => void;
  dismissWarning: () => void;
  setUpgradePromptVisible: (visible: boolean) => void;
  
  // UI state
  setUploadModalVisible: (visible: boolean) => void;
  setLivestreamModalVisible: (visible: boolean) => void;
  
  // Trending slider
  setTrendingSliderIndex: (index: number) => void;
  setTrendingAutoScroll: (enabled: boolean) => void;
  recordSliderInteraction: () => void;

  // Video player
  setCurrentVideo: (videoId: string | null) => void;
  setPlayerState: (state: Partial<VideoPlayerState>) => void;
  togglePlay: () => void;
  toggleMute: () => void;
  setProgress: (progress: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setQuality: (quality: VideoPlayerState['quality']) => void;

  // Watch history
  addToWatchHistory: (videoId: string, duration: number, progressPercent?: number) => void;
  clearWatchHistory: () => void;
  getRecentlyWatched: (limit?: number) => WatchHistoryEntry[];

  // Video queue
  setVideoQueue: (videoIds: string[]) => void;
  addToQueue: (videoId: string) => void;
  removeFromQueue: (videoId: string) => void;
  playNextInQueue: () => string | null;
  clearQueue: () => void;

  // Liked videos
  toggleLikeVideo: (videoId: string) => boolean;
  isVideoLiked: (videoId: string) => boolean;

  // Validation helpers
  validateFileSize: (sizeBytes: number) => { valid: boolean; error?: string };
  validateRecordingDuration: (seconds: number) => { valid: boolean; warning?: string; limitReached: boolean };
  validateLivestreamDuration: (seconds: number) => { valid: boolean; warning?: string; limitReached: boolean };
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialPlayerState: VideoPlayerState = {
  currentVideoId: null,
  isPlaying: false,
  isMuted: false,
  progress: 0,
  duration: 0,
  isFullscreen: false,
  playbackSpeed: 1,
  quality: 'auto',
};

const initialTrendingSliderState: TrendingSliderState = {
  activeIndex: 0,
  isAutoScrolling: false,
  lastInteractionAt: null,
};

const initialState: VideoState = {
  premiumStatus: {
    hasVideoPremium: false,
    maxUploadSize: FREE_UPLOAD_LIMIT_BYTES,
    maxRecordingDuration: FREE_LIVESTREAM_LIMIT_SECONDS,
    maxLivestreamDuration: FREE_LIVESTREAM_LIMIT_SECONDS,
  },
  currentUpload: null,
  uploadHistory: [],
  currentRecording: null,
  recordingHistory: [],
  currentLivestream: null,
  livestreamHistory: [],
  trendingSlider: initialTrendingSliderState,
  player: initialPlayerState,
  watchHistory: [],
  videoQueue: [],
  likedVideoIds: [],
  activeWarning: null,
  showUpgradePrompt: false,
  isUploadModalVisible: false,
  isLivestreamModalVisible: false,
  lastError: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// STORE
// ============================================================================

export const useVideoStore = create<VideoState & VideoActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      // Premium status
      setPremiumStatus: (status) => set({ premiumStatus: status }),
      
      refreshPremiumStatus: () => {
        // This will be called to sync with RevenueCat/backend
        // The actual implementation will use TanStack Query
      },

      // Upload management
      startUpload: (file) => {
        const { premiumStatus } = get();
        const validation = get().validateFileSize(file.size);
        
        if (!validation.valid) {
          set({ 
            lastError: validation.error,
            showUpgradePrompt: !premiumStatus.hasVideoPremium,
          });
          return null;
        }

        const upload: VideoUploadProgress = {
          fileId: generateSessionId(),
          fileName: file.name,
          fileSize: file.size,
          uploadedBytes: 0,
          progress: 0,
          status: 'uploading',
          startedAt: new Date().toISOString(),
        };

        set({ currentUpload: upload, lastError: null });
        return upload;
      },

      updateUploadProgress: (fileId, progress) => {
        const { currentUpload } = get();
        if (currentUpload?.fileId === fileId) {
          set({ currentUpload: { ...currentUpload, ...progress } });
        }
      },

      cancelUpload: (fileId) => {
        const { currentUpload, uploadHistory } = get();
        if (currentUpload?.fileId === fileId) {
          set({
            currentUpload: null,
            uploadHistory: [...uploadHistory, { ...currentUpload, status: 'error', error: 'Cancelled by user' }],
          });
        }
      },

      completeUpload: (fileId, _videoUrl) => {
        const { currentUpload, uploadHistory } = get();
        if (currentUpload?.fileId === fileId) {
          const completed = {
            ...currentUpload,
            status: 'completed' as const,
            progress: 100,
            uploadedBytes: currentUpload.fileSize,
            completedAt: new Date().toISOString(),
          };
          set({
            currentUpload: null,
            uploadHistory: [...uploadHistory, completed],
          });
        }
      },

      failUpload: (fileId, error) => {
        const { currentUpload, uploadHistory } = get();
        if (currentUpload?.fileId === fileId) {
          set({
            currentUpload: null,
            uploadHistory: [...uploadHistory, { ...currentUpload, status: 'error', error }],
            lastError: error,
          });
        }
      },

      clearUploadHistory: () => set({ uploadHistory: [] }),

      // Recording management
      startRecording: (options) => {
        const { premiumStatus } = get();
        const session: RecordingSession = {
          sessionId: generateSessionId(),
          startedAt: new Date().toISOString(),
          duration: 0,
          maxDuration: premiumStatus.maxRecordingDuration,
          status: 'recording',
          isFrontCamera: options?.isFrontCamera ?? false,
          isTorchOn: false,
          zoomLevel: 0,
        };

        set({ currentRecording: session, lastError: null });
        return session;
      },

      updateRecordingDuration: (duration) => {
        const { currentRecording, premiumStatus } = get();
        if (currentRecording) {
          const validation = get().validateRecordingDuration(duration);
          
          set({ 
            currentRecording: { ...currentRecording, duration },
            activeWarning: validation.warning ? {
              type: 'recording_duration',
              message: validation.warning,
              currentValue: duration,
              limitValue: premiumStatus.maxRecordingDuration,
              isPremiumRequired: !premiumStatus.hasVideoPremium,
            } : get().activeWarning,
          });
        }
      },

      pauseRecording: () => {
        const { currentRecording } = get();
        if (currentRecording) {
          set({ currentRecording: { ...currentRecording, status: 'paused' } });
        }
      },

      resumeRecording: () => {
        const { currentRecording } = get();
        if (currentRecording) {
          set({ currentRecording: { ...currentRecording, status: 'recording' } });
        }
      },

      stopRecording: (outputUri) => {
        const { currentRecording, recordingHistory } = get();
        if (currentRecording) {
          const completed = {
            ...currentRecording,
            status: 'completed' as const,
            outputUri,
          };
          set({
            currentRecording: null,
            recordingHistory: [...recordingHistory, completed],
            activeWarning: null,
          });
        }
      },

      failRecording: (error) => {
        const { currentRecording, recordingHistory } = get();
        if (currentRecording) {
          set({
            currentRecording: null,
            recordingHistory: [...recordingHistory, { ...currentRecording, status: 'error', error }],
            lastError: error,
          });
        }
      },

      // Livestream management
      startLivestream: (streamKey) => {
        const { premiumStatus } = get();
        const session: LivestreamSession = {
          sessionId: generateSessionId(),
          streamKey,
          startedAt: new Date().toISOString(),
          duration: 0,
          maxDuration: premiumStatus.maxLivestreamDuration,
          status: 'live',
          viewerCount: 0,
          peakViewers: 0,
        };

        set({ currentLivestream: session, lastError: null });
        return session;
      },

      updateLivestreamDuration: (duration) => {
        const { currentLivestream, premiumStatus } = get();
        if (currentLivestream) {
          const validation = get().validateLivestreamDuration(duration);
          
          set({ 
            currentLivestream: { ...currentLivestream, duration },
            activeWarning: validation.warning ? {
              type: 'livestream_duration',
              message: validation.warning,
              currentValue: duration,
              limitValue: premiumStatus.maxLivestreamDuration,
              isPremiumRequired: !premiumStatus.hasVideoPremium,
            } : get().activeWarning,
          });
        }
      },

      updateViewerCount: (count) => {
        const { currentLivestream } = get();
        if (currentLivestream) {
          set({
            currentLivestream: {
              ...currentLivestream,
              viewerCount: count,
              peakViewers: Math.max(currentLivestream.peakViewers, count),
            },
          });
        }
      },

      endLivestream: () => {
        const { currentLivestream, livestreamHistory } = get();
        if (currentLivestream) {
          const ended = { ...currentLivestream, status: 'ended' as const };
          set({
            currentLivestream: null,
            livestreamHistory: [...livestreamHistory, ended],
            activeWarning: null,
          });
        }
      },

      failLivestream: (error) => {
        const { currentLivestream, livestreamHistory } = get();
        if (currentLivestream) {
          set({
            currentLivestream: null,
            livestreamHistory: [...livestreamHistory, { ...currentLivestream, status: 'error', error }],
            lastError: error,
          });
        }
      },

      // Warnings & prompts
      showWarning: (warning) => set({ activeWarning: warning }),
      dismissWarning: () => set({ activeWarning: null }),
      setUpgradePromptVisible: (visible) => set({ showUpgradePrompt: visible }),

      // UI state
      setUploadModalVisible: (visible) => set({ isUploadModalVisible: visible }),
      setLivestreamModalVisible: (visible) => set({ isLivestreamModalVisible: visible }),

      // Trending slider
      setTrendingSliderIndex: (index) => set((state) => ({
        trendingSlider: { ...state.trendingSlider, activeIndex: index },
      })),

      setTrendingAutoScroll: (enabled) => set((state) => ({
        trendingSlider: { ...state.trendingSlider, isAutoScrolling: enabled },
      })),

      recordSliderInteraction: () => set((state) => ({
        trendingSlider: {
          ...state.trendingSlider,
          lastInteractionAt: new Date().toISOString(),
          isAutoScrolling: false, // Pause auto-scroll on user interaction
        },
      })),

      // Video player
      setCurrentVideo: (videoId) => set((state) => ({
        player: {
          ...state.player,
          currentVideoId: videoId,
          progress: 0,
          isPlaying: videoId !== null,
        },
      })),

      setPlayerState: (playerState) => set((state) => ({
        player: { ...state.player, ...playerState },
      })),

      togglePlay: () => set((state) => ({
        player: { ...state.player, isPlaying: !state.player.isPlaying },
      })),

      toggleMute: () => set((state) => ({
        player: { ...state.player, isMuted: !state.player.isMuted },
      })),

      setProgress: (progress) => set((state) => ({
        player: { ...state.player, progress },
      })),

      setPlaybackSpeed: (speed) => set((state) => ({
        player: { ...state.player, playbackSpeed: speed },
      })),

      setQuality: (quality) => set((state) => ({
        player: { ...state.player, quality },
      })),

      // Watch history
      addToWatchHistory: (videoId, duration, progressPercent = 0) => {
        const { watchHistory } = get();
        const existingIndex = watchHistory.findIndex(h => h.videoId === videoId);

        const entry: WatchHistoryEntry = {
          videoId,
          watchedAt: new Date().toISOString(),
          progressPercent,
          duration,
        };

        let newHistory: WatchHistoryEntry[];
        if (existingIndex >= 0) {
          // Update existing entry and move to front
          newHistory = [
            entry,
            ...watchHistory.filter((_, i) => i !== existingIndex),
          ];
        } else {
          // Add new entry to front
          newHistory = [entry, ...watchHistory];
        }

        // Keep only last 100 entries
        set({ watchHistory: newHistory.slice(0, 100) });
      },

      clearWatchHistory: () => set({ watchHistory: [] }),

      getRecentlyWatched: (limit = 10) => {
        const { watchHistory } = get();
        return watchHistory.slice(0, limit);
      },

      // Video queue
      setVideoQueue: (videoIds) => set({ videoQueue: videoIds }),

      addToQueue: (videoId) => {
        const { videoQueue } = get();
        if (!videoQueue.includes(videoId)) {
          set({ videoQueue: [...videoQueue, videoId] });
        }
      },

      removeFromQueue: (videoId) => {
        const { videoQueue } = get();
        set({ videoQueue: videoQueue.filter(id => id !== videoId) });
      },

      playNextInQueue: () => {
        const { videoQueue, player } = get();
        if (videoQueue.length === 0) return null;

        const nextVideoId = videoQueue[0];
        set({
          videoQueue: videoQueue.slice(1),
          player: {
            ...player,
            currentVideoId: nextVideoId,
            progress: 0,
            isPlaying: true,
          },
        });
        return nextVideoId;
      },

      clearQueue: () => set({ videoQueue: [] }),

      // Liked videos
      toggleLikeVideo: (videoId) => {
        const { likedVideoIds } = get();
        const isLiked = likedVideoIds.includes(videoId);

        if (isLiked) {
          set({ likedVideoIds: likedVideoIds.filter(id => id !== videoId) });
        } else {
          set({ likedVideoIds: [...likedVideoIds, videoId] });
        }

        return !isLiked; // Return new like state
      },

      isVideoLiked: (videoId) => {
        const { likedVideoIds } = get();
        return likedVideoIds.includes(videoId);
      },

      // Validation helpers
      validateFileSize: (sizeBytes) => {
        const { premiumStatus } = get();
        
        if (sizeBytes > premiumStatus.maxUploadSize) {
          if (premiumStatus.hasVideoPremium) {
            return {
              valid: false,
              error: `File size (${formatFileSize(sizeBytes)}) exceeds maximum of ${formatFileSize(PREMIUM_UPLOAD_LIMIT_BYTES)}`,
            };
          } else {
            return {
              valid: false,
              error: `File size (${formatFileSize(sizeBytes)}) exceeds free limit of ${formatFileSize(FREE_UPLOAD_LIMIT_BYTES)}. Upgrade to Video Premium for up to ${formatFileSize(PREMIUM_UPLOAD_LIMIT_BYTES)}.`,
            };
          }
        }
        
        return { valid: true };
      },

      validateRecordingDuration: (seconds) => {
        const { premiumStatus } = get();
        const warningThreshold = premiumStatus.maxRecordingDuration - 30; // 30 seconds before limit
        
        if (seconds >= premiumStatus.maxRecordingDuration) {
          return {
            valid: false,
            limitReached: true,
            warning: premiumStatus.hasVideoPremium
              ? 'Maximum recording duration reached'
              : `Recording limit reached. Upgrade to Video Premium for up to ${formatDuration(PREMIUM_RECORDING_LIMIT_SECONDS)}.`,
          };
        }
        
        if (seconds >= warningThreshold && !premiumStatus.hasVideoPremium) {
          return {
            valid: true,
            limitReached: false,
            warning: `Recording ends in ${formatDuration(premiumStatus.maxRecordingDuration - seconds)}`,
          };
        }
        
        return { valid: true, limitReached: false };
      },

      validateLivestreamDuration: (seconds) => {
        const { premiumStatus } = get();
        const warningThreshold = premiumStatus.maxLivestreamDuration - 30; // 30 seconds before limit
        
        if (seconds >= premiumStatus.maxLivestreamDuration) {
          return {
            valid: false,
            limitReached: true,
            warning: premiumStatus.hasVideoPremium
              ? 'Maximum livestream duration reached'
              : `Livestream limit reached. Upgrade to Video Premium for up to ${formatDuration(PREMIUM_LIVESTREAM_LIMIT_SECONDS)}.`,
          };
        }
        
        if (seconds >= warningThreshold && !premiumStatus.hasVideoPremium) {
          return {
            valid: true,
            limitReached: false,
            warning: `Livestream ends in ${formatDuration(premiumStatus.maxLivestreamDuration - seconds)}`,
          };
        }
        
        return { valid: true, limitReached: false };
      },

      // Error handling
      setError: (error) => set({ lastError: error }),
      clearError: () => set({ lastError: null }),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'video-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist certain state
        premiumStatus: state.premiumStatus,
        uploadHistory: state.uploadHistory.slice(-10), // Keep last 10
        recordingHistory: state.recordingHistory.slice(-10),
        livestreamHistory: state.livestreamHistory.slice(-10),
        watchHistory: state.watchHistory.slice(-50), // Keep last 50
        likedVideoIds: state.likedVideoIds, // Persist liked videos
      }),
    }
  ),
  { name: 'VideoStore', enabled: __DEV__ },
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectPremiumStatus = (state: VideoState) => state.premiumStatus;
export const selectHasVideoPremium = (state: VideoState) => state.premiumStatus.hasVideoPremium;
export const selectMaxUploadSize = (state: VideoState) => state.premiumStatus.maxUploadSize;
export const selectMaxRecordingDuration = (state: VideoState) => state.premiumStatus.maxRecordingDuration;
export const selectMaxLivestreamDuration = (state: VideoState) => state.premiumStatus.maxLivestreamDuration;

export const selectCurrentUpload = (state: VideoState) => state.currentUpload;
export const selectUploadHistory = (state: VideoState) => state.uploadHistory;
export const selectIsUploading = (state: VideoState) => state.currentUpload?.status === 'uploading';

export const selectCurrentRecording = (state: VideoState) => state.currentRecording;
export const selectRecordingHistory = (state: VideoState) => state.recordingHistory;
export const selectIsRecording = (state: VideoState) => state.currentRecording?.status === 'recording';

export const selectCurrentLivestream = (state: VideoState) => state.currentLivestream;
export const selectLivestreamHistory = (state: VideoState) => state.livestreamHistory;
export const selectIsLive = (state: VideoState) => state.currentLivestream?.status === 'live';

export const selectActiveWarning = (state: VideoState) => state.activeWarning;
export const selectShowUpgradePrompt = (state: VideoState) => state.showUpgradePrompt;

export const selectLastError = (state: VideoState) => state.lastError;

// Trending slider selectors
export const selectTrendingSlider = (state: VideoState) => state.trendingSlider;
export const selectTrendingSliderIndex = (state: VideoState) => state.trendingSlider.activeIndex;

// Video player selectors
export const selectPlayer = (state: VideoState) => state.player;
export const selectCurrentVideoId = (state: VideoState) => state.player.currentVideoId;
export const selectIsPlaying = (state: VideoState) => state.player.isPlaying;
export const selectIsMuted = (state: VideoState) => state.player.isMuted;

// Watch history selectors
export const selectWatchHistory = (state: VideoState) => state.watchHistory;
export const selectRecentlyWatched = (state: VideoState) => state.watchHistory.slice(0, 10);

// Video queue selectors
export const selectVideoQueue = (state: VideoState) => state.videoQueue;
export const selectQueueLength = (state: VideoState) => state.videoQueue.length;

// Liked videos selectors
export const selectLikedVideoIds = (state: VideoState) => state.likedVideoIds;

// ============================================================================
// COMPUTED SELECTORS
// ============================================================================

export const selectUploadProgress = (state: VideoState) => {
  const upload = state.currentUpload;
  if (!upload) return null;
  
  return {
    ...upload,
    formattedSize: formatFileSize(upload.fileSize),
    formattedUploaded: formatFileSize(upload.uploadedBytes),
    remainingBytes: upload.fileSize - upload.uploadedBytes,
    formattedRemaining: formatFileSize(upload.fileSize - upload.uploadedBytes),
  };
};

// Stable default objects to prevent infinite re-renders
const DEFAULT_RECORDING_PROGRESS = {
  sessionId: '',
  duration: 0,
  maxDuration: 0,
  status: 'idle' as RecordingStatus,
  formattedDuration: '0:00',
  formattedMaxDuration: '0:00',
  formattedRemaining: '0:00',
  progressPercent: 0,
  isNearLimit: false,
  isRecording: false,
};

const DEFAULT_LIVESTREAM_STATUS = {
  sessionId: '',
  duration: 0,
  maxDuration: 0,
  viewerCount: 0,
  status: 'idle' as LivestreamStatus,
  formattedDuration: '0:00',
  formattedMaxDuration: '0:00',
  formattedRemaining: '0:00',
  progressPercent: 0,
  isNearLimit: false,
  isActive: false,
};

export const selectRecordingProgress = (state: VideoState) => {
  const recording = state.currentRecording;
  if (!recording) {
    return DEFAULT_RECORDING_PROGRESS;
  }
  
  const remainingSeconds = recording.maxDuration - recording.duration;
  const progressPercent = (recording.duration / recording.maxDuration) * 100;
  
  return {
    ...recording,
    formattedDuration: formatDuration(recording.duration),
    formattedMaxDuration: formatDuration(recording.maxDuration),
    formattedRemaining: formatDuration(remainingSeconds),
    progressPercent,
    isNearLimit: remainingSeconds <= 30,
    isRecording: recording.status === 'recording',
  };
};

export const selectLivestreamStatus = (state: VideoState) => {
  const livestream = state.currentLivestream;
  if (!livestream) {
    return DEFAULT_LIVESTREAM_STATUS;
  }

  const remainingSeconds = livestream.maxDuration - livestream.duration;
  const progressPercent = (livestream.duration / livestream.maxDuration) * 100;

  return {
    ...livestream,
    formattedDuration: formatDuration(livestream.duration),
    formattedMaxDuration: formatDuration(livestream.maxDuration),
    formattedRemaining: formatDuration(remainingSeconds),
    progressPercent,
    isNearLimit: remainingSeconds <= 30,
    isActive: livestream.status === 'live',
  };
};

export const selectLivestreamProgress = (state: VideoState) => {
  const livestream = state.currentLivestream;
  if (!livestream) return null;
  
  const remainingSeconds = livestream.maxDuration - livestream.duration;
  const progressPercent = (livestream.duration / livestream.maxDuration) * 100;
  
  return {
    ...livestream,
    formattedDuration: formatDuration(livestream.duration),
    formattedMaxDuration: formatDuration(livestream.maxDuration),
    formattedRemaining: formatDuration(remainingSeconds),
    progressPercent,
    isNearLimit: remainingSeconds <= 30,
  };
};

// ============================================================================
// Convenience Hooks — pre-wrapped with useShallow (re-render safe)
// ============================================================================

/** Premium status — shallow-compared, re-render safe */
export const useVideoPremiumStatus = () => useVideoStore(useShallow(selectPremiumStatus));

/** Trending slider state — shallow-compared, re-render safe */
export const useVideoTrendingSlider = () => useVideoStore(useShallow(selectTrendingSlider));

/** Player state — shallow-compared, re-render safe */
export const useVideoPlayer = () => useVideoStore(useShallow(selectPlayer));

/** Upload progress — shallow-compared, re-render safe */
export const useVideoUploadProgress = () => useVideoStore(useShallow(selectUploadProgress));

/** Recording progress — shallow-compared, re-render safe */
export const useVideoRecordingProgress = () => useVideoStore(useShallow(selectRecordingProgress));

/** Livestream status — shallow-compared, re-render safe */
export const useVideoLivestreamStatus = () => useVideoStore(useShallow(selectLivestreamStatus));

/** Livestream progress — shallow-compared, re-render safe */
export const useVideoLivestreamProgress = () => useVideoStore(useShallow(selectLivestreamProgress));
