/**
 * Regression tests for services/viewTracker.ts — the organic view recorder
 * wired into the feed's play_3s milestone (video remediation PR 2).
 *
 * Locks: one network call per video per app session (layer 2 of the dedup
 * stack: milestone flag → session Set → server day-bucket), and fire-and-forget
 * behavior — a failing send never throws into the playback path and does not
 * re-open the dedup for that video.
 */
jest.mock('@/services/videoApi', () => ({
  videoApi: { incrementView: jest.fn() },
}));

import { videoApi } from '@/services/videoApi';
import { recordView, __resetViewTrackerForTests } from '@/services/viewTracker';

const incrementViewMock = videoApi.incrementView as jest.Mock;

beforeEach(() => {
  __resetViewTrackerForTests();
  incrementViewMock.mockReset();
  incrementViewMock.mockResolvedValue({ success: true, data: { views: 1 } });
});

describe('recordView session dedup', () => {
  it('fires exactly one incrementView per video per session', () => {
    recordView('v1');
    recordView('v1');
    recordView('v1');

    expect(incrementViewMock).toHaveBeenCalledTimes(1);
    expect(incrementViewMock).toHaveBeenCalledWith('v1');
  });

  it('records different videos independently', () => {
    recordView('v1');
    recordView('v2');
    recordView('v1');

    expect(incrementViewMock).toHaveBeenCalledTimes(2);
    expect(incrementViewMock.mock.calls.map((c) => c[0])).toEqual(['v1', 'v2']);
  });

  it('ignores an empty video id', () => {
    recordView('');

    expect(incrementViewMock).not.toHaveBeenCalled();
  });
});

describe('recordView fire-and-forget', () => {
  it('does not throw when the send rejects', async () => {
    incrementViewMock.mockRejectedValueOnce(new Error('network down'));

    expect(() => recordView('v1')).not.toThrow();
    // Let the rejected promise settle — the .catch(() => {}) must absorb it
    // (an unhandled rejection would fail the test run).
    await Promise.resolve();
  });

  it('keeps the video deduped even after a failed send (server replay is safe, not needed)', async () => {
    incrementViewMock.mockRejectedValueOnce(new Error('network down'));

    recordView('v1');
    await Promise.resolve();
    recordView('v1');

    expect(incrementViewMock).toHaveBeenCalledTimes(1);
  });
});
