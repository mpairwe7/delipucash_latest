/**
 * Tests for the client AI survey API (creation PR 4). fetch + auth store mocked.
 * Locks the mapping of the server draft to builder questions and error surfacing.
 */
import { generateAiSurvey } from '@/services/aiSurveyApi';
import { useAuthStore } from '@/utils/auth/store';

jest.mock('@/utils/auth/store', () => ({
  useAuthStore: { getState: jest.fn() },
}));

const mockedGetState = useAuthStore.getState as jest.Mock;

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  mockedGetState.mockReturnValue({ auth: { token: 'tok-123' } });
});

it('requires authentication', async () => {
  mockedGetState.mockReturnValue({ auth: null });
  const r = await generateAiSurvey({ prompt: 'x' });
  expect(r.success).toBe(false);
  expect(r.code).toBe('NOT_AUTHENTICATED');
});

it('maps a successful draft into builder questions with ids', async () => {
  mockFetchOnce(200, {
    success: true,
    title: 'Coffee CSAT',
    description: 'How was it?',
    questions: [
      { text: 'How satisfied?', type: 'rating', options: [], required: true, minValue: 1, maxValue: 5 },
      { text: 'Which drink?', type: 'radio', options: ['Latte', 'Tea'] },
    ],
  });

  const r = await generateAiSurvey({ prompt: 'coffee shop satisfaction' });
  expect(r.success).toBe(true);
  expect(r.title).toBe('Coffee CSAT');
  expect(r.questions).toHaveLength(2);
  // mapped to BuilderQuestionData: ids assigned, nullable fields present
  expect(r.questions![0].id).toMatch(/^ai_/);
  expect(r.questions![0]).toMatchObject({ type: 'rating', minValue: 1, maxValue: 5, conditionalLogic: null });
  expect(r.questions![1].options).toEqual(['Latte', 'Tea']);
});

it('surfaces the server error message + code (e.g. AI unavailable)', async () => {
  mockFetchOnce(503, { success: false, code: 'AI_UNAVAILABLE', message: 'AI generation is not available right now.' });
  const r = await generateAiSurvey({ prompt: 'x' });
  expect(r.success).toBe(false);
  expect(r.code).toBe('AI_UNAVAILABLE');
  expect(r.error).toMatch(/not available/i);
});

it('handles a network throw gracefully', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
  const r = await generateAiSurvey({ prompt: 'x' });
  expect(r.success).toBe(false);
  expect(r.code).toBe('NETWORK_ERROR');
});
