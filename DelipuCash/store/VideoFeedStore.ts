/**
 * VideoFeedStore - Advanced Video Feed State Management
 * TikTok/Instagram Reels/YouTube Shorts inspired feed orchestration
 * 
 * Architecture:
 * - Single active video playback control
 * - Visibility-based auto-play/pause
 * - Preloading strategy for zero-buffering
 * - Gesture state management
 * - Feed mode switching (vertical/grid)
 * 
 * @module store/VideoFeedStore
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Video } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Visibility threshold for auto-play (percentage 0-1) */
export const AUTOPLAY_VISIBILITY_THRESHOLD = 0.5;

/** Visibility threshold for pause (percentage 0-1) */
export const PAUSE_VISIBILITY_THRESHOLD = 0.3;

/** Number of videos to preload ahead */
export const PRELOAD_AHEAD_COUNT = 2;

/** Number of videos to preload behind */
export const PRELOAD_BEHIND_COUNT = 1;

/** Default snap interval for vertical feed */
export const SNAP_TO_INTERVAL_RATIO = 1; // Full screen height

// ============================================================================
// TYPES
// ============================================================================

export type FeedMode = 'vertical' | 'grid';
export type FeedTab = 'for-you' | 'following' | 'trending' | 'live';
export type PlayerStatus = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error' | 'ended';

export interface VideoVisibility {
  videoId: string;
  visiblePercentage: number;
  isVisible: boolean;
  index: number;
}

export interface ActiveVideoState {
  videoId: string | null;
  index: number;
  status: PlayerStatus;
  isMuted: boolean;
  progress: number;
  duration: number;
  bufferProgress: number;
  error?: string;
}

export interface GestureState {
  isDoubleTapping: boolean;
  doubleTapSide: 'left' | 'right' | 'center' | null;
  isLongPressing: boolean;
  isSwipingVertical: boolean;
  swipeVelocity: number;
}

export interface PreloadState {
  preloadedIds: string[];
  loadingIds: string[];
  failedIds: string[];
}

export interface FeedUIState {
  isRefreshing: boolean;
  isLoadingMore: boolean;
  showComments: boolean;
  commentsVideoId: string | null;
  showMiniPlayer: boolean;
  miniPlayerVideoId: string | null;
  showFullPlayer: boolean;
  fullPlayerVideoId: string | null;
}

export interface VideoFeedState {
  // Feed configuration
  feedMode: FeedMode;
  activeTab: FeedTab;
  
  // Video data (indexed for O(1) lookup)
  videos: Video[];
  videoMap: Map<string, Video>;
  
  // Active playback state
  activeVideo: ActiveVideoState;
  
  // Visibility tracking
  visibleVideos: VideoVisibility[];
  viewableIndices: number[];
  
  // Gesture state
  gesture: GestureState;
  
  // Preloading state
  preload: PreloadState;
  
  // UI state
  ui: FeedUIState;
  
  // Liked videos (optimistic)
  likedVideoIds: Set<string>;
  
  // Bookmarked videos
  bookmarkedVideoIds: Set<string>;
  
  // Watch history
  watchedVideoIds: string[];
}

export interface VideoFeedActions {
  // Feed configuration
  setFeedMode: (mode: FeedMode) => void;
  setActiveTab: (tab: FeedTab) => void;
  
  // Video data management
  setVideos: (videos: Video[]) => void;
  appendVideos: (videos: Video[]) => void;
  prependVideos: (videos: Video[]) => void;
  updateVideo: (videoId: string, updates: Partial<Video>) => void;
  
  // Playback control
  setActiveVideo: (videoId: string | null, index?: number) => void;
  setPlayerStatus: (status: PlayerStatus, error?: string) => void;
  setProgress: (progress: number, duration?: number) => void;
  setBufferProgress: (bufferProgress: number) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  
  // Visibility management
  handleViewableItemsChanged: (viewableItems: { item: Video; index: number; isViewable: boolean }[]) => void;
  updateVideoVisibility: (videoId: string, visiblePercentage: number, index: number) => void;
  
  // Gesture handling
  setDoubleTap: (side: 'left' | 'right' | 'center' | null) => void;
  setLongPress: (isLongPressing: boolean) => void;
  setSwipeState: (isSwipingVertical: boolean, velocity?: number) => void;
  
  // Preloading
  markPreloaded: (videoId: string) => void;
  markPreloadFailed: (videoId: string) => void;
  clearPreloadState: () => void;
  getPreloadTargets: () => string[];
  
  // UI state
  setRefreshing: (isRefreshing: boolean) => void;
  setLoadingMore: (isLoadingMore: boolean) => void;
  openComments: (videoId: string) => void;
  closeComments: () => void;
  openFullPlayer: (videoId: string) => void;
  closeFullPlayer: () => void;
  minimizeToMiniPlayer: (videoId: string) => void;
  closeMiniPlayer: () => void;
  expandMiniPlayer: () => void;
  
  // Engagement
  toggleLike: (videoId: string) => boolean; // Returns new state
  toggleBookmark: (videoId: string) => boolean;
  addToWatchHistory: (videoId: string) => void;
  
  // Utilities
  getVideoById: (videoId: string) => Video | undefined;
  getVideoAtIndex: (index: number) => Video | undefined;
  getActiveVideoData: () => Video | undefined;
  shouldVideoPlay: (videoId: string) => boolean;
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialActiveVideo: ActiveVideoState = {
  videoId: null,
  index: -1,
  status: 'idle',
  isMuted: true, // Start muted for autoplay
  progress: 0,
  duration: 0,
  bufferProgress: 0,
};

const initialGesture: GestureState = {
  isDoubleTapping: false,
  doubleTapSide: null,
  isLongPressing: false,
  isSwipingVertical: false,
  swipeVelocity: 0,
};

const initialPreload: PreloadState = {
  preloadedIds: [],
  loadingIds: [],
  failedIds: [],
};

const initialUI: FeedUIState = {
  isRefreshing: false,
  isLoadingMore: false,
  showComments: false,
  commentsVideoId: null,
  showMiniPlayer: false,
  miniPlayerVideoId: null,
  showFullPlayer: false,
  fullPlayerVideoId: null,
};

const initialState: VideoFeedState = {
  feedMode: 'vertical',
  activeTab: 'for-you',
  videos: [],
  videoMap: new Map(),
  activeVideo: initialActiveVideo,
  visibleVideos: [],
  viewableIndices: [],
  gesture: initialGesture,
  preload: initialPreload,
  ui: initialUI,
  likedVideoIds: new Set(),
  bookmarkedVideoIds: new Set(),
  watchedVideoIds: [],
};

// ============================================================================
// STORE
// ============================================================================

export const useVideoFeedStore = create<VideoFeedState & VideoFeedActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // ========================================================================
    // FEED CONFIGURATION
    // ========================================================================

    setFeedMode: (mode) => {
      set({ feedMode: mode });
      // Reset active video when switching modes
      if (mode === 'grid') {
        set({
          activeVideo: { ...initialActiveVideo },
        });
      }
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
    },

    // ========================================================================
    // VIDEO DATA MANAGEMENT
    // ========================================================================

    setVideos: (videos) => {
      const videoMap = new Map(videos.map((v) => [v.id, v]));
      set({
        videos,
        videoMap,
        preload: initialPreload,
      });
    },

    appendVideos: (newVideos) => {
      const { videos, videoMap } = get();
      const updatedVideos = [...videos, ...newVideos];
      newVideos.forEach((v) => videoMap.set(v.id, v));
      set({
        videos: updatedVideos,
        videoMap: new Map(videoMap),
      });
    },

    prependVideos: (newVideos) => {
      const { videos, videoMap } = get();
      const updatedVideos = [...newVideos, ...videos];
      newVideos.forEach((v) => videoMap.set(v.id, v));
      set({
        videos: updatedVideos,
        videoMap: new Map(videoMap),
      });
    },

    updateVideo: (videoId, updates) => {
      const { videos, videoMap } = get();
      const video = videoMap.get(videoId);
      if (!video) return;

      const updatedVideo = { ...video, ...updates };
      videoMap.set(videoId, updatedVideo);

      set({
        videos: videos.map((v) => (v.id === videoId ? updatedVideo : v)),
        videoMap: new Map(videoMap),
      });
    },

    // ========================================================================
    // PLAYBACK CONTROL
    // ========================================================================

    setActiveVideo: (videoId, index = -1) => {
      const { activeVideo, videos } = get();
      
      // If same video, don't reset state
      if (activeVideo.videoId === videoId) return;

      const actualIndex = index >= 0 ? index : videos.findIndex((v) => v.id === videoId);

      set({
        activeVideo: {
          videoId,
          index: actualIndex,
          status: videoId ? 'loading' : 'idle',
          isMuted: activeVideo.isMuted, // Preserve mute state
          progress: 0,
          duration: 0,
          bufferProgress: 0,
        },
      });

      // Add to watch history
      if (videoId) {
        get().addToWatchHistory(videoId);
      }
    },

    setPlayerStatus: (status, error) => {
      set((state) => ({
        activeVideo: {
          ...state.activeVideo,
          status,
          error: error ?? state.activeVideo.error,
        },
      }));
    },

    setProgress: (progress, duration) => {
      set((state) => ({
        activeVideo: {
          ...state.activeVideo,
          progress,
          duration: duration ?? state.activeVideo.duration,
        },
      }));
    },

    setBufferProgress: (bufferProgress) => {
      set((state) => ({
        activeVideo: {
          ...state.activeVideo,
          bufferProgress,
        },
      }));
    },

    toggleMute: () => {
      set((state) => ({
        activeVideo: {
          ...state.activeVideo,
          isMuted: !state.activeVideo.isMuted,
        },
      }));
    },

    setMuted: (muted) => {
      set((state) => ({
        activeVideo: {
          ...state.activeVideo,
          isMuted: muted,
        },
      }));
    },

    // ========================================================================
    // VISIBILITY MANAGEMENT (Core auto-play logic)
    // ========================================================================

    handleViewableItemsChanged: (viewableItems) => {
      const { feedMode, activeVideo } = get();
      
      // In grid mode, don't auto-play
      if (feedMode === 'grid') {
        set({ viewableIndices: viewableItems.map((v) => v.index) });
        return;
      }

      const visibleVideos: VideoVisibility[] = viewableItems
        .filter((item) => item.isViewable)
        .map((item) => ({
          videoId: item.item.id,
          visiblePercentage: 1, // FlatList considers fully visible
          isVisible: true,
          index: item.index,
        }));

      // Find the most visible video (typically the one in the center)
      const mostVisible = visibleVideos.reduce<VideoVisibility | null>((best, current) => {
        if (!best) return current;
        // Prefer the one closest to center (lower index difference from active)
        return current.visiblePercentage > best.visiblePercentage ? current : best;
      }, null);

      // Auto-play the most visible video
      if (mostVisible && mostVisible.videoId !== activeVideo.videoId) {
        get().setActiveVideo(mostVisible.videoId, mostVisible.index);
      }

      set({
        visibleVideos,
        viewableIndices: viewableItems.map((v) => v.index),
      });
    },

    updateVideoVisibility: (videoId, visiblePercentage, index) => {
      const { visibleVideos, activeVideo, feedMode } = get();
      
      if (feedMode === 'grid') return;

      const existingIndex = visibleVideos.findIndex((v) => v.videoId === videoId);
      const visibility: VideoVisibility = {
        videoId,
        visiblePercentage,
        isVisible: visiblePercentage >= PAUSE_VISIBILITY_THRESHOLD,
        index,
      };

      const updatedVisibleVideos =
        existingIndex >= 0
          ? visibleVideos.map((v, i) => (i === existingIndex ? visibility : v))
          : [...visibleVideos, visibility];

      // Check if current video should be paused
      const currentVisibility = updatedVisibleVideos.find((v) => v.videoId === activeVideo.videoId);
      if (currentVisibility && currentVisibility.visiblePercentage < PAUSE_VISIBILITY_THRESHOLD) {
        // Current video is less visible, find new active video
        const mostVisible = updatedVisibleVideos
          .filter((v) => v.visiblePercentage >= AUTOPLAY_VISIBILITY_THRESHOLD)
          .sort((a, b) => b.visiblePercentage - a.visiblePercentage)[0];

        if (mostVisible && mostVisible.videoId !== activeVideo.videoId) {
          get().setActiveVideo(mostVisible.videoId, mostVisible.index);
        }
      }

      set({ visibleVideos: updatedVisibleVideos });
    },

    // ========================================================================
    // GESTURE HANDLING
    // ========================================================================

    setDoubleTap: (side) => {
      set((state) => ({
        gesture: {
          ...state.gesture,
          isDoubleTapping: side !== null,
          doubleTapSide: side,
        },
      }));

      // Auto-reset after animation
      if (side !== null) {
        setTimeout(() => {
          set((state) => ({
            gesture: {
              ...state.gesture,
              isDoubleTapping: false,
              doubleTapSide: null,
            },
          }));
        }, 800);
      }
    },

    setLongPress: (isLongPressing) => {
      set((state) => ({
        gesture: {
          ...state.gesture,
          isLongPressing,
        },
      }));
    },

    setSwipeState: (isSwipingVertical, velocity = 0) => {
      set((state) => ({
        gesture: {
          ...state.gesture,
          isSwipingVertical,
          swipeVelocity: velocity,
        },
      }));
    },

    // ========================================================================
    // PRELOADING
    // ========================================================================

    markPreloaded: (videoId) => {
      set((state) => ({
        preload: {
          ...state.preload,
          preloadedIds: [...state.preload.preloadedIds, videoId],
          loadingIds: state.preload.loadingIds.filter((id) => id !== videoId),
        },
      }));
    },

    markPreloadFailed: (videoId) => {
      set((state) => ({
        preload: {
          ...state.preload,
          failedIds: [...state.preload.failedIds, videoId],
          loadingIds: state.preload.loadingIds.filter((id) => id !== videoId),
        },
      }));
    },

    clearPreloadState: () => {
      set({ preload: initialPreload });
    },

    getPreloadTargets: () => {
      const { videos, activeVideo, preload } = get();
      const currentIndex = activeVideo.index;
      
      if (currentIndex < 0 || videos.length === 0) return [];

      const targets: string[] = [];
      const { preloadedIds, loadingIds, failedIds } = preload;
      const alreadyHandled = new Set([...preloadedIds, ...loadingIds, ...failedIds]);

      // Preload ahead
      for (let i = 1; i <= PRELOAD_AHEAD_COUNT; i++) {
        const targetIndex = currentIndex + i;
        if (targetIndex < videos.length) {
          const videoId = videos[targetIndex].id;
          if (!alreadyHandled.has(videoId)) {
            targets.push(videoId);
          }
        }
      }

      // Preload behind
      for (let i = 1; i <= PRELOAD_BEHIND_COUNT; i++) {
        const targetIndex = currentIndex - i;
        if (targetIndex >= 0) {
          const videoId = videos[targetIndex].id;
          if (!alreadyHandled.has(videoId)) {
            targets.push(videoId);
          }
        }
      }

      return targets;
    },

    // ========================================================================
    // UI STATE
    // ========================================================================

    setRefreshing: (isRefreshing) => {
      set((state) => ({
        ui: { ...state.ui, isRefreshing },
      }));
    },

    setLoadingMore: (isLoadingMore) => {
      set((state) => ({
        ui: { ...state.ui, isLoadingMore },
      }));
    },

    openComments: (videoId) => {
      set((state) => ({
        ui: { ...state.ui, showComments: true, commentsVideoId: videoId },
      }));
    },

    closeComments: () => {
      set((state) => ({
        ui: { ...state.ui, showComments: false, commentsVideoId: null },
      }));
    },

    openFullPlayer: (videoId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          showFullPlayer: true,
          fullPlayerVideoId: videoId,
          showMiniPlayer: false,
        },
      }));
    },

    closeFullPlayer: () => {
      const { ui } = get();
      // Transition to mini player if video was playing
      if (ui.fullPlayerVideoId) {
        set((state) => ({
          ui: {
            ...state.ui,
            showFullPlayer: false,
            showMiniPlayer: true,
            miniPlayerVideoId: state.ui.fullPlayerVideoId,
            fullPlayerVideoId: null,
          },
        }));
      } else {
        set((state) => ({
          ui: {
            ...state.ui,
            showFullPlayer: false,
            fullPlayerVideoId: null,
          },
        }));
      }
    },

    minimizeToMiniPlayer: (videoId) => {
      set((state) => ({
        ui: {
          ...state.ui,
          showFullPlayer: false,
          showMiniPlayer: true,
          miniPlayerVideoId: videoId,
          fullPlayerVideoId: null,
        },
      }));
    },

    closeMiniPlayer: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          showMiniPlayer: false,
          miniPlayerVideoId: null,
        },
        activeVideo: initialActiveVideo,
      }));
    },

    expandMiniPlayer: () => {
      const { ui } = get();
      if (ui.miniPlayerVideoId) {
        set((state) => ({
          ui: {
            ...state.ui,
            showMiniPlayer: false,
            showFullPlayer: true,
            fullPlayerVideoId: state.ui.miniPlayerVideoId,
            miniPlayerVideoId: null,
          },
        }));
      }
    },

    // ========================================================================
    // ENGAGEMENT
    // ========================================================================

    toggleLike: (videoId) => {
      const { likedVideoIds, videoMap, videos } = get();
      const newLikedIds = new Set(likedVideoIds);
      const isNowLiked = !likedVideoIds.has(videoId);

      if (isNowLiked) {
        newLikedIds.add(videoId);
      } else {
        newLikedIds.delete(videoId);
      }

      // Optimistic update of like count
      const video = videoMap.get(videoId);
      if (video) {
        const likeDelta = isNowLiked ? 1 : -1;
        const updatedVideo = { ...video, likes: (video.likes || 0) + likeDelta };
        videoMap.set(videoId, updatedVideo);

        set({
          likedVideoIds: newLikedIds,
          videos: videos.map((v) => (v.id === videoId ? updatedVideo : v)),
          videoMap: new Map(videoMap),
        });
      } else {
        set({ likedVideoIds: newLikedIds });
      }

      return isNowLiked;
    },

    toggleBookmark: (videoId) => {
      const { bookmarkedVideoIds } = get();
      const newBookmarkedIds = new Set(bookmarkedVideoIds);
      const isNowBookmarked = !bookmarkedVideoIds.has(videoId);

      if (isNowBookmarked) {
        newBookmarkedIds.add(videoId);
      } else {
        newBookmarkedIds.delete(videoId);
      }

      set({ bookmarkedVideoIds: newBookmarkedIds });
      return isNowBookmarked;
    },

    addToWatchHistory: (videoId) => {
      const { watchedVideoIds } = get();
      const filtered = watchedVideoIds.filter((id) => id !== videoId);
      const updated = [videoId, ...filtered].slice(0, 100); // Keep last 100
      set({ watchedVideoIds: updated });
    },

    // ========================================================================
    // UTILITIES
    // ========================================================================

    getVideoById: (videoId) => {
      return get().videoMap.get(videoId);
    },

    getVideoAtIndex: (index) => {
      const { videos } = get();
      return videos[index];
    },

    getActiveVideoData: () => {
      const { activeVideo, videoMap } = get();
      return activeVideo.videoId ? videoMap.get(activeVideo.videoId) : undefined;
    },

    shouldVideoPlay: (videoId) => {
      const { activeVideo, feedMode, ui } = get();
      if (feedMode === 'grid') return false;
      if (ui.showFullPlayer || ui.showComments) return false;
      return activeVideo.videoId === videoId && activeVideo.status === 'playing';
    },

    reset: () => {
      set(initialState);
    },
  }))
);

// ============================================================================
// SELECTORS (for optimized re-renders)
// ============================================================================

export const selectActiveVideo = (state: VideoFeedState) => state.activeVideo;
export const selectFeedMode = (state: VideoFeedState) => state.feedMode;
export const selectActiveTab = (state: VideoFeedState) => state.activeTab;
export const selectVideos = (state: VideoFeedState) => state.videos;
export const selectUI = (state: VideoFeedState) => state.ui;
export const selectGesture = (state: VideoFeedState) => state.gesture;
export const selectLikedVideoIds = (state: VideoFeedState) => state.likedVideoIds;
export const selectBookmarkedVideoIds = (state: VideoFeedState) => state.bookmarkedVideoIds;

// Derived selectors
export const selectIsVideoLiked = (videoId: string) => (state: VideoFeedState) =>
  state.likedVideoIds.has(videoId);

export const selectIsVideoBookmarked = (videoId: string) => (state: VideoFeedState) =>
  state.bookmarkedVideoIds.has(videoId);

export const selectIsActiveVideo = (videoId: string) => (state: VideoFeedState) =>
  state.activeVideo.videoId === videoId;

export const selectShouldVideoPlay = (videoId: string) => (state: VideoFeedState) => {
  if (state.feedMode === 'grid') return false;
  if (state.ui.showFullPlayer || state.ui.showComments) return false;
  return state.activeVideo.videoId === videoId;
};
