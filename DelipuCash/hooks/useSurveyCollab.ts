/**
 * useSurveyCollab — SSE subscription + REST calls for real-time collaboration
 *
 * Tracks active editors, question locks, and provides join/leave/lock/unlock actions.
 * Uses EventSource for SSE and REST for mutations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

export interface CollabEditor {
  userId: string;
  firstName: string;
  avatar: string | null;
  lockedQuestionId: string | null;
  joinedAt: string;
}

interface UseSurveyCollabOptions {
  surveyId: string;
  /** Disable collab (e.g. when not in edit mode) */
  enabled?: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useSurveyCollab({ surveyId, enabled = true }: UseSurveyCollabOptions) {
  const [editors, setEditors] = useState<CollabEditor[]>([]);
  const [lockedQuestions, setLockedQuestions] = useState<Record<string, string>>({}); // questionId → userId
  const hasJoined = useRef(false);

  // Join session on mount
  useEffect(() => {
    if (!enabled || !surveyId) return;

    const join = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/collab/join`, {
          method: 'POST',
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setEditors(data.data);
          hasJoined.current = true;
          // Build lock map from editors
          const locks: Record<string, string> = {};
          for (const editor of data.data) {
            if (editor.lockedQuestionId) {
              locks[editor.lockedQuestionId] = editor.userId;
            }
          }
          setLockedQuestions(locks);
        }
      } catch {
        // Silently fail — collab is optional
      }
    };
    join();

    // Leave on unmount
    return () => {
      if (hasJoined.current) {
        fetch(`${API_BASE_URL}/api/surveys/${surveyId}/collab/leave`, {
          method: 'POST',
          headers: authHeaders(),
        }).catch(() => {});
        hasJoined.current = false;
      }
    };
  }, [surveyId, enabled]);

  // Poll active editors periodically (fallback for SSE gaps)
  useEffect(() => {
    if (!enabled || !surveyId) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/collab/editors`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (data.success && data.data) {
          setEditors(data.data);
          const locks: Record<string, string> = {};
          for (const editor of data.data) {
            if (editor.lockedQuestionId) {
              locks[editor.lockedQuestionId] = editor.userId;
            }
          }
          setLockedQuestions(locks);
        }
      } catch {
        // Ignore
      }
    };

    const interval = setInterval(poll, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [surveyId, enabled]);

  // Lock a question
  const lockQuestion = useCallback(async (questionId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/collab/lock`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ questionId }),
      });
      const data = await res.json();
      if (data.success) {
        setLockedQuestions((prev) => ({ ...prev, [questionId]: useAuthStore.getState().auth?.user?.id || '' }));
      }
      return data;
    } catch {
      return { success: false };
    }
  }, [surveyId]);

  // Unlock current question
  const unlockQuestion = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/surveys/${surveyId}/collab/unlock`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        const userId = useAuthStore.getState().auth?.user?.id;
        setLockedQuestions((prev) => {
          const next = { ...prev };
          for (const [qId, uId] of Object.entries(next)) {
            if (uId === userId) delete next[qId];
          }
          return next;
        });
      }
      return data;
    } catch {
      return { success: false };
    }
  }, [surveyId]);

  // Check if a question is locked by another user
  const isLockedByOther = useCallback((questionId: string) => {
    const lockerId = lockedQuestions[questionId];
    if (!lockerId) return false;
    const userId = useAuthStore.getState().auth?.user?.id;
    return lockerId !== userId;
  }, [lockedQuestions]);

  // Get the editor who locked a question
  const getLocker = useCallback((questionId: string): CollabEditor | undefined => {
    const lockerId = lockedQuestions[questionId];
    if (!lockerId) return undefined;
    return editors.find((e) => e.userId === lockerId);
  }, [lockedQuestions, editors]);

  return {
    editors,
    lockedQuestions,
    lockQuestion,
    unlockQuestion,
    isLockedByOther,
    getLocker,
    editorCount: editors.length,
  };
}
