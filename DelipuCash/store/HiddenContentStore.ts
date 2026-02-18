/**
 * HiddenContentStore — User-controlled content hiding (Not Interested / Hide Creator)
 *
 * Architecture:
 * - Zustand + persist (survives app restarts via AsyncStorage)
 * - Capped at 500 items per array with FIFO eviction
 * - Follows AdUIStore patterns (devtools, useShallow convenience hooks, selectors)
 *
 * Usage:
 *   import { useHiddenContentStore } from '@/store';
 *   const hideVideo = useHiddenContentStore((s) => s.hideVideo);
 *   hideVideo('video-123');
 *
 * @module store/HiddenContentStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_HIDDEN_ITEMS = 500;

// ============================================================================
// TYPES
// ============================================================================

export interface HiddenContentState {
  hiddenVideoIds: string[];
  hiddenCreatorIds: string[];
  hiddenSoundIds: string[];
  notInterestedVideoIds: string[];
}

export interface HiddenContentActions {
  hideVideo: (videoId: string) => void;
  hideCreator: (creatorId: string) => void;
  hideSound: (soundId: string) => void;
  markNotInterested: (videoId: string) => void;

  unhideVideo: (videoId: string) => void;
  unhideCreator: (creatorId: string) => void;
  unhideSound: (soundId: string) => void;

  isVideoHidden: (videoId: string) => boolean;
  isCreatorHidden: (creatorId: string) => boolean;

  reset: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Add item with FIFO eviction at MAX_HIDDEN_ITEMS */
const addCapped = (arr: string[], item: string): string[] => {
  if (arr.includes(item)) return arr;
  const next = [...arr, item];
  return next.length > MAX_HIDDEN_ITEMS ? next.slice(next.length - MAX_HIDDEN_ITEMS) : next;
};

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: HiddenContentState = {
  hiddenVideoIds: [],
  hiddenCreatorIds: [],
  hiddenSoundIds: [],
  notInterestedVideoIds: [],
};

// ============================================================================
// STORE
// ============================================================================

export const useHiddenContentStore = create<HiddenContentState & HiddenContentActions>()(
  devtools(
  persist(
    (set, get) => ({
      ...initialState,

      hideVideo: (videoId) => {
        set((s) => ({ hiddenVideoIds: addCapped(s.hiddenVideoIds, videoId) }));
      },

      hideCreator: (creatorId) => {
        set((s) => ({ hiddenCreatorIds: addCapped(s.hiddenCreatorIds, creatorId) }));
      },

      hideSound: (soundId) => {
        set((s) => ({ hiddenSoundIds: addCapped(s.hiddenSoundIds, soundId) }));
      },

      markNotInterested: (videoId) => {
        set((s) => ({
          notInterestedVideoIds: addCapped(s.notInterestedVideoIds, videoId),
          hiddenVideoIds: addCapped(s.hiddenVideoIds, videoId),
        }));
      },

      unhideVideo: (videoId) => {
        set((s) => ({
          hiddenVideoIds: s.hiddenVideoIds.filter((id) => id !== videoId),
          notInterestedVideoIds: s.notInterestedVideoIds.filter((id) => id !== videoId),
        }));
      },

      unhideCreator: (creatorId) => {
        set((s) => ({
          hiddenCreatorIds: s.hiddenCreatorIds.filter((id) => id !== creatorId),
        }));
      },

      unhideSound: (soundId) => {
        set((s) => ({
          hiddenSoundIds: s.hiddenSoundIds.filter((id) => id !== soundId),
        }));
      },

      isVideoHidden: (videoId) => {
        const { hiddenVideoIds } = get();
        return hiddenVideoIds.includes(videoId);
      },

      isCreatorHidden: (creatorId) => {
        const { hiddenCreatorIds } = get();
        return hiddenCreatorIds.includes(creatorId);
      },

      reset: () => set(initialState),
    }),
    {
      name: 'hidden-content-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
  { name: 'HiddenContentStore', enabled: __DEV__ },
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectHiddenVideoIds = (state: HiddenContentState) => state.hiddenVideoIds;
export const selectHiddenCreatorIds = (state: HiddenContentState) => state.hiddenCreatorIds;
export const selectHiddenSoundIds = (state: HiddenContentState) => state.hiddenSoundIds;
export const selectNotInterestedVideoIds = (state: HiddenContentState) => state.notInterestedVideoIds;

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

export const useHiddenVideoIds = () => useHiddenContentStore(useShallow(selectHiddenVideoIds));
export const useHiddenCreatorIds = () => useHiddenContentStore(useShallow(selectHiddenCreatorIds));

export default useHiddenContentStore;
