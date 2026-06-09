/**
 * Phase 4 a11y regression: the production feed skeleton (SkeletonLoaders.Shimmer) must
 * respect the OS reduce-motion setting (WCAG 2.3.3) — holding a static skeleton instead
 * of looping its shimmer. We can't observe the shared-value animation under the Reanimated
 * mock, so this asserts the reduce-motion code path renders the skeleton in BOTH modes
 * without error (the branch that previously didn't exist).
 */
import React from 'react';
import { renderWithProviders } from '@/test-utils';
import { useReducedMotion } from '@/utils/accessibility';
import { QuestionFeedSkeleton } from '@/components/feed/SkeletonLoaders';

jest.mock('@/utils/accessibility', () => ({
  ...jest.requireActual('@/utils/accessibility'),
  useReducedMotion: jest.fn(),
}));

const mockReducedMotion = useReducedMotion as jest.Mock;

describe('SkeletonLoaders — reduced motion', () => {
  it('renders the feed skeleton with reduce-motion ENABLED (static, no crash)', () => {
    mockReducedMotion.mockReturnValue(true);
    const { toJSON } = renderWithProviders(<QuestionFeedSkeleton count={3} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the feed skeleton with reduce-motion DISABLED (animated path)', () => {
    mockReducedMotion.mockReturnValue(false);
    const { toJSON } = renderWithProviders(<QuestionFeedSkeleton count={3} />);
    expect(toJSON()).toBeTruthy();
  });
});
