/**
 * Regression test for useSubmitSurvey retry behaviour.
 *
 * Submitting a survey response is a non-idempotent POST, and the server enforces a
 * single attempt per user (unique (userId, surveyId) → 409). Auto-retrying a POST
 * whose success response was merely lost would re-submit and surface a confusing
 * "already completed" error, so the mutation is configured with `retry: 0`. A
 * per-mutation `retry` overrides the QueryClient default, so this assertion is
 * meaningful even though the test client also defaults to no retries.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createProvidersWrapper } from '@/test-utils';
import { useSubmitSurvey } from '@/services/hooks';
import api from '@/services/api';

describe('useSubmitSurvey', () => {
  let submitSpy: jest.SpyInstance;

  afterEach(() => submitSpy?.mockRestore());

  it('does NOT retry the POST when the submission fails', async () => {
    submitSpy = jest
      .spyOn(api.surveys, 'submit')
      .mockResolvedValue({ success: false, error: 'network error' } as never);

    const { result } = renderHook(() => useSubmitSurvey(), {
      wrapper: createProvidersWrapper(),
    });

    act(() => {
      result.current.mutate({ surveyId: 's-1', responses: { q1: 'yes' } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Called exactly once — a retry would invoke the endpoint a second time.
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('returns the awarded points on success', async () => {
    submitSpy = jest.spyOn(api.surveys, 'submit').mockResolvedValue({
      success: true,
      data: { pointsAwarded: 10, cashEquivalent: 400, message: 'ok' },
    } as never);

    const { result } = renderHook(() => useSubmitSurvey(), {
      wrapper: createProvidersWrapper(),
    });

    act(() => {
      result.current.mutate({ surveyId: 's-1', responses: { q1: 'yes' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pointsAwarded).toBe(10);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
