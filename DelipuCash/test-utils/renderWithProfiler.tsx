import React, { Profiler } from 'react';
import type { ReactElement } from 'react';
import { renderWithProviders } from './renderWithProviders';
import type { RenderWithProvidersOptions } from './renderWithProviders';

export interface ProfilerCounter {
  /** Number of React commits in the profiled subtree (initial mount counts as 1). */
  commits: number;
  /** actualDuration (ms) of the most recent commit — advisory; CI timing is noisy. */
  lastActualDuration: number;
}

/**
 * Render a tree wrapped in a React <Profiler> (and the standard providers) so tests can
 * assert how many commits an interaction costs — a React-19-compatible render-count
 * regression guard.
 *
 * Why not Reassure: reassure@1.4's `measureRenders` hangs under React 19.1.0 + jest-expo
 * (react-test-renderer is deprecated in React 19 and its measure loop never resolves).
 * RNTL's own render works fine, so we count commits via Profiler.onRender instead.
 *
 * Usage:
 *   const { profiler, ...screen } = renderWithProfiler(<Screen />);
 *   const before = profiler.commits;
 *   fireEvent.press(screen.getByText('Latest'));
 *   expect(profiler.commits - before).toBeLessThanOrEqual(BASELINE);
 */
export function renderWithProfiler(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const profiler: ProfilerCounter = { commits: 0, lastActualDuration: 0 };
  const onRender = (
    _id: string,
    _phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number
  ) => {
    profiler.commits += 1;
    profiler.lastActualDuration = actualDuration;
  };

  const wrapped = (
    <Profiler id="perf" onRender={onRender}>
      {ui}
    </Profiler>
  );

  return { profiler, ...renderWithProviders(wrapped, options) };
}
