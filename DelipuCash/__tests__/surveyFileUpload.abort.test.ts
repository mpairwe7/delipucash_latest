/**
 * Regression tests for survey file-upload cancellation
 * (services/surveyFileApi.ts#uploadSurveyFile — the r2UploadService precedent).
 *
 * Before the fix there was NO way to cancel: a stalled large file left the
 * respondent stuck (the attempt screen blocks Next while uploading) with no
 * out short of killing the app. uploadSurveyFile now accepts an AbortSignal,
 * aborts the XHR when it fires, and resolves { cancelled: true } (this API
 * resolves errors rather than rejecting).
 */
jest.mock('@/utils/auth/store', () => ({
  useAuthStore: { getState: () => ({ auth: { token: 'test-token' } }) },
}));

import { uploadSurveyFile } from '@/services/surveyFileApi';

// Minimal XHR mock — records abort() and fires the matching handler.
class MockXHR {
  static instances: MockXHR[] = [];
  upload: { onprogress: ((e: unknown) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  aborted = false;
  status = 200;
  responseText = '';
  constructor() {
    MockXHR.instances.push(this);
  }
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe('uploadSurveyFile — abort support', () => {
  const original = (global as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  beforeEach(() => {
    MockXHR.instances = [];
    (global as { XMLHttpRequest: unknown }).XMLHttpRequest = MockXHR;
  });
  afterEach(() => {
    (global as { XMLHttpRequest?: unknown }).XMLHttpRequest = original;
  });

  it('short-circuits with cancelled:true and never allocates an XHR when pre-aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await uploadSurveyFile('s1', 'q1', 'file:///doc.pdf', 'doc.pdf', 'application/pdf', {
      signal: controller.signal,
    });

    expect(result).toMatchObject({ success: false, cancelled: true });
    expect(MockXHR.instances).toHaveLength(0);
  });

  it('aborts the in-flight XHR and resolves cancelled:true when the signal fires', async () => {
    const controller = new AbortController();
    const promise = uploadSurveyFile('s1', 'q1', 'file:///doc.pdf', 'doc.pdf', 'application/pdf', {
      signal: controller.signal,
    });

    expect(MockXHR.instances).toHaveLength(1);
    controller.abort();

    const result = await promise;
    expect(MockXHR.instances[0].aborted).toBe(true);
    expect(result).toMatchObject({ success: false, cancelled: true });
  });

  it('a normal completion still resolves success and does not abort', async () => {
    const controller = new AbortController();
    const promise = uploadSurveyFile('s1', 'q1', 'file:///doc.pdf', 'doc.pdf', 'application/pdf', {
      signal: controller.signal,
    });

    const xhr = MockXHR.instances[0];
    xhr.status = 201;
    xhr.responseText = JSON.stringify({ success: true, data: { id: 'f1', fileName: 'doc.pdf' } });
    xhr.onload?.();

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ id: 'f1' });
    expect(xhr.aborted).toBe(false);
  });
});
