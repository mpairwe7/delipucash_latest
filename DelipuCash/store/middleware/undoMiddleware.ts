/**
 * Generic Undo/Redo Middleware for Zustand
 *
 * Intercepts `set()` calls to build a bounded temporal history stack.
 * Only tracks the subset of state specified by `partialize`.
 *
 * Features:
 * - Bounded past/future stacks (configurable, default 50)
 * - Coalescing window for rapid text edits (configurable, default 1000ms)
 * - Skip flag to allow non-undoable state transitions
 * - Works with any Zustand store shape
 *
 * Usage:
 *   create<MyState>()(undoMiddleware((set, get) => ({ ... }), { limit: 50 }))
 */

import type { StateCreator, StoreMutatorIdentifier } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export interface UndoState {
  /** Stack of past states (most recent at end) */
  _past: unknown[];
  /** Stack of future states (most recent at start) */
  _future: unknown[];
  /** Timestamp of last snapshot push */
  _lastSnapshotAt: number;
}

export interface UndoActions {
  /** Revert to the previous state snapshot */
  undo: () => void;
  /** Re-apply the next state snapshot (after undo) */
  redo: () => void;
  /** Whether an undo is available */
  canUndo: boolean;
  /** Whether a redo is available */
  canRedo: boolean;
  /** Clear all undo/redo history */
  clearHistory: () => void;
}

export interface UndoOptions<T> {
  /** Maximum number of history snapshots (default: 50) */
  limit?: number;
  /**
   * Extract the trackable slice of state.
   * Only changes to this slice will be pushed to the history stack.
   * Must return a new object each call (will be deep-compared by reference).
   */
  partialize: (state: T) => unknown;
  /**
   * Coalescing window in ms (default: 1000).
   * Rapid `set()` calls within this window merge into a single undo step.
   * Set to 0 to disable coalescing.
   */
  coalesceMs?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Deep-clone a plain JSON value via structured clone (or JSON fallback) */
function snapshot<V>(value: V): V {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

/** Shallow equality check for plain objects (one level deep) */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// We use a simple wrapper approach for maximum compatibility
type UndoMiddleware = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  options: UndoOptions<T>,
) => StateCreator<T & UndoState & UndoActions, Mps, Mcs>;

/**
 * Create a Zustand store creator with undo/redo support.
 *
 * Instead of a true Zustand middleware (which requires complex type mutators),
 * this is a helper that wraps a store creator function and injects undo state + actions.
 */
export const withUndo: UndoMiddleware = (f, options) => (set, get, store) => {
  const { limit = 50, partialize, coalesceMs = 1000 } = options;

  // Flag to skip history tracking (used internally during undo/redo)
  let skipTracking = false;

  // Override set to intercept state changes
  const originalSet = set;
  const trackedSet: typeof set = (...args: Parameters<typeof set>) => {
    if (!skipTracking) {
      const prevState = get() as T & UndoState & UndoActions;
      const prevTracked = partialize(prevState as T);
      const now = Date.now();

      // Apply the state change first
      originalSet(...args);

      const nextState = get() as T & UndoState & UndoActions;
      const nextTracked = partialize(nextState as T);

      // Only push if the tracked slice actually changed
      if (!shallowEqual(prevTracked, nextTracked)) {
        const timeSinceLast = now - (prevState._lastSnapshotAt || 0);

        if (coalesceMs > 0 && timeSinceLast < coalesceMs && prevState._past.length > 0) {
          // Coalesce: don't push a new snapshot, just update lastSnapshotAt
          // The previous snapshot already captures the pre-edit state
          originalSet({ _lastSnapshotAt: now } as Partial<T & UndoState & UndoActions>);
        } else {
          // Push the PREVIOUS tracked state onto past stack
          const newPast = [...prevState._past, snapshot(prevTracked)];
          // Trim if over limit
          if (newPast.length > limit) {
            newPast.splice(0, newPast.length - limit);
          }
          originalSet({
            _past: newPast,
            _future: [], // Clear future on new changes
            _lastSnapshotAt: now,
            canUndo: true,
            canRedo: false,
          } as Partial<T & UndoState & UndoActions>);
        }
      }
    } else {
      originalSet(...args);
    }
  };

  // Create the base state from the original creator
  const baseState = f(trackedSet as typeof set, get, store);

  return {
    ...baseState,

    // Undo state
    _past: [] as unknown[],
    _future: [] as unknown[],
    _lastSnapshotAt: 0,
    canUndo: false,
    canRedo: false,

    undo: () => {
      const state = get() as T & UndoState & UndoActions;
      if (state._past.length === 0) return;

      const newPast = [...state._past];
      const previousTracked = newPast.pop()!;
      const currentTracked = snapshot(partialize(state as T));

      skipTracking = true;
      set({
        ...previousTracked as Partial<T>,
        _past: newPast,
        _future: [currentTracked, ...state._future],
        _lastSnapshotAt: Date.now(),
        canUndo: newPast.length > 0,
        canRedo: true,
      } as Partial<T & UndoState & UndoActions>);
      skipTracking = false;
    },

    redo: () => {
      const state = get() as T & UndoState & UndoActions;
      if (state._future.length === 0) return;

      const newFuture = [...state._future];
      const nextTracked = newFuture.shift()!;
      const currentTracked = snapshot(partialize(state as T));

      skipTracking = true;
      set({
        ...nextTracked as Partial<T>,
        _past: [...state._past, currentTracked],
        _future: newFuture,
        _lastSnapshotAt: Date.now(),
        canUndo: true,
        canRedo: newFuture.length > 0,
      } as Partial<T & UndoState & UndoActions>);
      skipTracking = false;
    },

    clearHistory: () => {
      set({
        _past: [],
        _future: [],
        _lastSnapshotAt: 0,
        canUndo: false,
        canRedo: false,
      } as Partial<T & UndoState & UndoActions>);
    },
  };
};

export default withUndo;
