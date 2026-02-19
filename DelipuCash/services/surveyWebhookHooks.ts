/**
 * Survey Webhook TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  type CreateWebhookPayload,
  type UpdateWebhookPayload,
} from './surveyWebhookApi';

// ── Query Keys ─────────────────────────────────────────────────────

const webhookKeys = {
  all: ['survey-webhooks'] as const,
  list: (surveyId: string) => [...webhookKeys.all, surveyId] as const,
};

// ── Hooks ──────────────────────────────────────────────────────────

export function useSurveyWebhooks(surveyId: string) {
  return useQuery({
    queryKey: webhookKeys.list(surveyId),
    queryFn: async () => {
      const result = await listWebhooks(surveyId);
      if (!result.success) throw new Error(result.message || 'Failed to fetch webhooks');
      return result.data ?? [];
    },
    enabled: !!surveyId,
  });
}

export function useCreateWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWebhookPayload) => createWebhook(surveyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(surveyId) });
    },
  });
}

export function useUpdateWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, payload }: { webhookId: string; payload: UpdateWebhookPayload }) =>
      updateWebhook(surveyId, webhookId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(surveyId) });
    },
  });
}

export function useDeleteWebhook(surveyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(surveyId, webhookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(surveyId) });
    },
  });
}

export function useTestWebhook(surveyId: string) {
  return useMutation({
    mutationFn: (webhookId: string) => testWebhook(surveyId, webhookId),
  });
}
