/**
 * Regression tests for upload cancellation.
 *
 * Before the fix, cancelling/closing the upload modal only mutated Zustand state;
 * the in-flight XHR kept running and could still finalize server-side. The upload
 * functions now accept an AbortSignal and call xhr.abort() when it fires. These
 * tests verify both the pre-aborted short-circuit and mid-flight abort.
 */
import { uploadToPresignedUrl } from '@/services/r2UploadService';

// Minimal XHR mock — records abort() and lets the test resolve via send → abort.
class MockXHR {
  static instances: MockXHR[] = [];
  upload = { addEventListener: jest.fn() };
  listeners: Record<string, (() => void)[]> = {};
  aborted = false;
  status = 200;
  responseText = '';
  timeout = 0;
  constructor() {
    MockXHR.instances.push(this);
  }
  addEventListener(type: string, cb: () => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
  abort() {
    this.aborted = true;
    (this.listeners['abort'] || []).forEach((cb) => cb());
  }
}

describe('uploadToPresignedUrl — abort support', () => {
  const original = (global as any).XMLHttpRequest;
  beforeEach(() => {
    MockXHR.instances = [];
    (global as any).XMLHttpRequest = MockXHR as any;
  });
  afterEach(() => {
    (global as any).XMLHttpRequest = original;
  });

  it('rejects immediately and never creates an XHR when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadToPresignedUrl('https://r2/put', 'file:///v.mp4', 'video/mp4', { signal: controller.signal }),
    ).rejects.toThrow(/cancelled/i);

    expect(MockXHR.instances).toHaveLength(0); // short-circuited before allocating XHR
  });

  it('calls xhr.abort() and rejects when the signal fires mid-flight', async () => {
    const controller = new AbortController();
    const promise = uploadToPresignedUrl('https://r2/put', 'file:///v.mp4', 'video/mp4', {
      signal: controller.signal,
    });

    // XHR was created and send() was called
    expect(MockXHR.instances).toHaveLength(1);
    const xhr = MockXHR.instances[0];
    expect(xhr.send).toHaveBeenCalled();

    // Cancelling aborts the underlying request
    controller.abort();
    expect(xhr.aborted).toBe(true);

    await expect(promise).rejects.toThrow(/cancelled/i);
  });
});
