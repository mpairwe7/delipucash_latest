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
 *   create<MyState & MyActions & UndoState & UndoActions>()(
 *     withUndo((set, get) => ({ ... }), { partialize: ... })
 *   )
 */

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

export interface UndoOptions<TState> {
  /** Maximum number of history snapshots (default: 50) */
  limit?: number;
  /**
   * Extract the trackable slice of state.
   * Only changes to this slice will be pushed to the history stack.
   * Must return a new object each call (will be deep-compared by reference).
   */
  partialize: (state: TState) => unknown;
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

/**
 * Create a Zustand store creator with undo/redo support.
 *
 * The combined store type `T` must include both your state + actions AND
 * UndoState + UndoActions. The inner creator only needs to define the
 * non-undo parts; undo state + actions are injected automatically.
 *
 * @param f - The inner state creator (defines your app state + actions)
 * @param options - Undo options: partialize, limit, coalesceMs
 */
export function withUndo<T extends object>(
  f: (
    set: (partial: Partial<T> | ((state: T) => Partial<T>)) => void,
    get: () => T,
    store: any,
  ) => Omit<T, keyof UndoState | keyof UndoActions>,
  options: UndoOptions<T>,
): (
  set: (partial: any) => void,
  get: () => any,
  store: any,
) => T & UndoState & UndoActions {
  const { limit = 50, partialize, coalesceMs = 1000 } = options;

  return (set: any, get: any, store: any) => {
    // Flag to skip history tracking (used internally during undo/redo)
    let skipTracking = false;

    // Override set to intercept state changes
    const originalSet = set;
    const trackedSet = (partial: any, replace?: boolean) => {
      if (!skipTracking) {
        const prevState = get();
        const prevTracked = partialize(prevState);
        const now = Date.now();

        // Apply the state change first
        originalSet(partial, replace);

        const nextState = get();
        const nextTracked = partialize(nextState);

        // Only push if the tracked slice actually changed
        if (!shallowEqual(prevTracked, nextTracked)) {
          const timeSinceLast = now - (prevState._lastSnapshotAt || 0);

          if (coalesceMs > 0 && timeSinceLast < coalesceMs && prevState._past.length > 0) {
            // Coalesce: don't push a new snapshot, just update lastSnapshotAt
            originalSet({ _lastSnapshotAt: now });
          } else {
            // Push the PREVIOUS tracked state onto past stack
            const newPast = [...prevState._past, snapshot(prevTracked)];
            // Trim if over limit
            if (newPast.length > limit) {
              newPast.splice(0, newPast.length - limit);
            }
            originalSet({
              _past: newPast,
              _future: [],
              _lastSnapshotAt: now,
              canUndo: true,
              canRedo: false,
            });
          }
        }
      } else {
        originalSet(partial, replace);
      }
    };

    // Create the base state from the original creator
    const baseState = f(trackedSet, get, store);

    return {
      ...baseState,

      // Undo state
      _past: [] as unknown[],
      _future: [] as unknown[],
      _lastSnapshotAt: 0,
      canUndo: false,
      canRedo: false,

      undo: () => {
        const state = get();
        if (state._past.length === 0) return;

        const newPast = [...state._past];
        const previousTracked = newPast.pop()!;
        const currentTracked = snapshot(partialize(state));

        skipTracking = true;
        set({
          ...(previousTracked as object),
          _past: newPast,
          _future: [currentTracked, ...state._future],
          _lastSnapshotAt: Date.now(),
          canUndo: newPast.length > 0,
          canRedo: true,
        });
        skipTracking = false;
      },

      redo: () => {
        const state = get();
        if (state._future.length === 0) return;

        const newFuture = [...state._future];
        const nextTracked = newFuture.shift()!;
        const currentTracked = snapshot(partialize(state));

        skipTracking = true;
        set({
          ...(nextTracked as object),
          _past: [...state._past, currentTracked],
          _future: newFuture,
          _lastSnapshotAt: Date.now(),
          canUndo: true,
          canRedo: newFuture.length > 0,
        });
        skipTracking = false;
      },

      clearHistory: () => {
        set({
          _past: [],
          _future: [],
          _lastSnapshotAt: 0,
          canUndo: false,
          canRedo: false,
        });
      },
    } as T & UndoState & UndoActions;
  };
}

export default withUndo;
