/**
 * Survey File Upload API Service
 *
 * Handles file uploads for survey questions of type 'file_upload'.
 * Uses FormData multipart upload with progress tracking.
 */

import { useAuthStore } from '@/utils/auth/store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

function getAuthToken(): string | null {
  return useAuthStore.getState().auth?.token || null;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ============================================================================
// TYPES
// ============================================================================

export interface SurveyFileUploadResult {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  uploadedAt: string;
}

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number; // 0-100
}

export interface UploadOptions {
  onProgress?: (event: UploadProgressEvent) => void;
}

// ============================================================================
// UPLOAD FILE
// ============================================================================

export async function uploadSurveyFile(
  surveyId: string,
  questionId: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  options: UploadOptions = {},
): Promise<{ success: boolean; data?: SurveyFileUploadResult; error?: string }> {
  const token = getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
    formData.append('questionId', questionId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/surveys/${surveyId}/files`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress({
          loaded: event.loaded,
          total: event.total,
          progress: Math.round((event.loaded / event.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && response.success) {
          resolve({ success: true, data: response.data });
        } else {
          resolve({ success: false, error: response.error || 'Upload failed' });
        }
      } catch {
        resolve({ success: false, error: 'Failed to parse response' });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: 'Network error during upload' });
    };

    xhr.send(formData);
  });
}

// ============================================================================
// GET DOWNLOAD URL
// ============================================================================

export async function getSurveyFileDownloadUrl(
  surveyId: string,
  fileId: string,
): Promise<{ success: boolean; data?: SurveyFileUploadResult; error?: string }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/surveys/${surveyId}/files/${fileId}`,
      { headers: authHeaders() },
    );
    const result = await response.json();
    return result;
  } catch {
    return { success: false, error: 'Failed to fetch download URL' };
  }
}

// ============================================================================
// DELETE FILE
// ============================================================================

export async function deleteSurveyFile(
  surveyId: string,
  fileId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/surveys/${surveyId}/files/${fileId}`,
      { method: 'DELETE', headers: authHeaders() },
    );
    const result = await response.json();
    return result;
  } catch {
    return { success: false, error: 'Failed to delete file' };
  }
}
