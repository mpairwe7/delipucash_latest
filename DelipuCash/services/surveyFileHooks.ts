/**
 * Survey File Upload Hooks
 *
 * TanStack Query hooks for survey file upload operations.
 * Provides progress tracking and optimistic cache updates.
 */

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  uploadSurveyFile,
  getSurveyFileDownloadUrl,
  deleteSurveyFile,
  type SurveyFileUploadResult,
  type UploadProgressEvent,
} from './surveyFileApi';

// ============================================================================
// UPLOAD HOOK
// ============================================================================

interface UseUploadSurveyFileParams {
  surveyId: string;
  questionId: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
}

export function useUploadSurveyFile() {
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();
  // One controller per in-flight upload — cancel() aborts the actual XHR
  // (not just UI state; see r2UploadService abort precedent).
  const abortRef = useRef<AbortController | null>(null);

  const mutation = useMutation<
    { success: boolean; data?: SurveyFileUploadResult; error?: string; cancelled?: boolean },
    Error,
    UseUploadSurveyFileParams
  >({
    mutationFn: ({ surveyId, questionId, fileUri, fileName, mimeType }) => {
      abortRef.current = new AbortController();
      return uploadSurveyFile(surveyId, questionId, fileUri, fileName, mimeType, {
        onProgress: (event: UploadProgressEvent) => setProgress(event.progress),
        signal: abortRef.current.signal,
      });
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate any cached file queries for this survey
        queryClient.invalidateQueries({
          queryKey: ['surveyFile', variables.surveyId],
        });
      }
      setProgress(0);
    },
    onError: () => {
      setProgress(0);
    },
    onSettled: () => {
      abortRef.current = null;
    },
  });

  const reset = useCallback(() => {
    setProgress(0);
    mutation.reset();
  }, [mutation]);

  /** Abort the in-flight upload (no-op when idle). The mutation settles with
   *  { cancelled: true } rather than throwing. */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    ...mutation,
    progress,
    isUploading: mutation.isPending,
    reset,
    cancel,
  };
}

// ============================================================================
// DOWNLOAD URL HOOK
// ============================================================================

export function useSurveyFileDownload(surveyId: string, fileId: string) {
  return useQuery({
    queryKey: ['surveyFile', surveyId, fileId],
    queryFn: () => getSurveyFileDownloadUrl(surveyId, fileId),
    enabled: !!surveyId && !!fileId,
    staleTime: 1000 * 60 * 50, // Presigned URL valid for ~1h, refresh at 50min
  });
}

// ============================================================================
// DELETE HOOK
// ============================================================================

export function useDeleteSurveyFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ surveyId, fileId }: { surveyId: string; fileId: string }) =>
      deleteSurveyFile(surveyId, fileId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['surveyFile', variables.surveyId],
      });
    },
  });
}
