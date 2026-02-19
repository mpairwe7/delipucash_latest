/**
 * Survey Webhook API Service
 *
 * CRUD + test for survey webhooks.
 */

import { useAuthStore } from '@/utils/auth/store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

function getAuthToken(): string | null {
  return useAuthStore.getState().auth?.token || null;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ── Types ──────────────────────────────────────────────────────────

export interface SurveyWebhook {
  id: string;
  surveyId: string;
  url: string;
  events: string[];
  secret?: string | null;
  isActive: boolean;
  lastFired?: string | null;
  lastStatus?: number | null;
  failCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookPayload {
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookPayload {
  url?: string;
  events?: string[];
  secret?: string;
  isActive?: boolean;
}

// ── API Calls ──────────────────────────────────────────────────────

export async function createWebhook(
  surveyId: string,
  payload: CreateWebhookPayload,
): Promise<{ success: boolean; data?: SurveyWebhook; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/webhooks`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function listWebhooks(
  surveyId: string,
): Promise<{ success: boolean; data?: SurveyWebhook[]; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/webhooks`, {
    headers: authHeaders(),
  });
  return res.json();
}

export async function updateWebhook(
  surveyId: string,
  webhookId: string,
  payload: UpdateWebhookPayload,
): Promise<{ success: boolean; data?: SurveyWebhook; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/webhooks/${webhookId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteWebhook(
  surveyId: string,
  webhookId: string,
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function testWebhook(
  surveyId: string,
  webhookId: string,
): Promise<{ success: boolean; status?: number; message?: string }> {
  const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/webhooks/${webhookId}/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return res.json();
}
