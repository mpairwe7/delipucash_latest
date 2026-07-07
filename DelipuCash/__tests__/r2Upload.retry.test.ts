/**
 * Regression tests for upload resilience (uploadVideoViaPresignedUrl).
 *
 * Before the fix, one transient network blip anywhere in the flow threw the
 * whole upload away:
 * - the R2 PUT had zero retries (a dropped connection lost the transfer), and
 * - the finalize POST had zero retries and no timeout (a single failed JSON
 *   request orphaned an already-completed R2 upload).
 *
 * These tests lock in: transfer retries get a FRESH presigned URL; finalize
 * retries transient 5xx without re-transferring the file; 4xx fails fast;
 * user cancellation is never retried.
 */
import {
  uploadVideoViaPresignedUrl,
  finalizeVideoUploadOnly,
} from '@/services/r2UploadService';

/** Scripted XHR: each send() consumes the next action from MockXHR.script. */
class MockXHR {
  static instances: MockXHR[] = [];
  static script: ('error' | 'load')[] = [];
  status = 0;
  responseText = '';
  timeout = 0;
  upload = { addEventListener: jest.fn() };
  listeners: Record<string, (() => void)[]> = {};
  constructor() {
    MockXHR.instances.push(this);
  }
  addEventListener(type: string, cb: () => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn(() => {
    const action = MockXHR.script.shift();
    if (!action) return; // stay in-flight (test drives abort manually)
    queueMicrotask(() => {
      if (action === 'error') this.fire('error');
      else {
        this.status = 200;
        this.fire('load');
      }
    });
  });
  abort() {
    this.fire('abort');
  }
  fire(type: string) {
    (this.listeners[type] || []).forEach((cb) => cb());
  }
}

/** Route fetch calls: presign returns a numbered URL/key; finalize is scripted. */
let presignCount: number;
let finalizeCalls: any[];
let finalizeResponses: { status: number; body: Record<string, unknown> }[];

const jsonResponse = (status: number, body: Record<string, unknown>) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

describe('uploadVideoViaPresignedUrl — retry resilience', () => {
  const originalXHR = (global as any).XMLHttpRequest;
  const originalFetch = global.fetch;

  beforeEach(() => {
    MockXHR.instances = [];
    MockXHR.script = [];
    presignCount = 0;
    finalizeCalls = [];
    finalizeResponses = [];

    (global as any).XMLHttpRequest = MockXHR as any;
    global.fetch = jest.fn(async (url: any, init?: any) => {
      const href = String(url);
      if (href.includes('/api/r2/presign/upload')) {
        presignCount += 1;
        return jsonResponse(200, {
          uploadUrl: `https://r2.example/put/${presignCount}`,
          key: `key-${presignCount}`,
          publicUrl: `https://cdn.example/${presignCount}`,
        });
      }
      if (href.includes('/api/r2/upload/finalize-video')) {
        finalizeCalls.push(JSON.parse(init.body));
        const next = finalizeResponses.shift() ??
          { status: 200, body: { video: { id: 'v1', videoUrl: 'https://cdn.example/1' } } };
        return jsonResponse(next.status, next.body);
      }
      throw new Error(`Unexpected fetch: ${href}`);
    }) as any;
  });

  afterEach(() => {
    (global as any).XMLHttpRequest = originalXHR;
    global.fetch = originalFetch;
  });

  it('retries a failed transfer with a FRESH presigned URL and finalizes with the retry key', async () => {
    MockXHR.script = ['error', 'load']; // first PUT drops, second succeeds

    const result = await uploadVideoViaPresignedUrl('file:///v.mp4', 'u1', { title: 'T' });

    expect(result.success).toBe(true);
    expect(presignCount).toBe(2); // fresh URL per attempt — expired links recover too
    expect(MockXHR.instances[1].open).toHaveBeenCalledWith('PUT', 'https://r2.example/put/2');
    expect(finalizeCalls[0].r2VideoKey).toBe('key-2'); // finalize uses the SUCCESSFUL attempt's key
  }, 15_000);

  it('retries a transient finalize 500 WITHOUT re-transferring the file', async () => {
    MockXHR.script = ['load'];
    finalizeResponses = [
      { status: 500, body: { message: 'upstream hiccup' } },
      { status: 200, body: { video: { id: 'v1', videoUrl: 'https://cdn.example/1' } } },
    ];

    const result = await uploadVideoViaPresignedUrl('file:///v.mp4', 'u1', { title: 'T' });

    expect(result.success).toBe(true);
    expect(finalizeCalls).toHaveLength(2);
    expect(MockXHR.instances).toHaveLength(1); // the expensive upload ran exactly once
  }, 15_000);

  it('fails fast on a non-retryable finalize 4xx', async () => {
    MockXHR.script = ['load'];
    finalizeResponses = [{ status: 400, body: { message: 'Bad metadata' } }];

    await expect(
      uploadVideoViaPresignedUrl('file:///v.mp4', 'u1', { title: 'T' }),
    ).rejects.toThrow('Bad metadata');

    expect(finalizeCalls).toHaveLength(1); // no pointless retries on validation errors
  });

  it('exposes finalizePayload on the error when finalize exhausts retries (queue recovery contract)', async () => {
    MockXHR.script = ['load'];
    finalizeResponses = [
      { status: 500, body: { message: 'down' } },
      { status: 500, body: { message: 'down' } },
      { status: 500, body: { message: 'down' } },
    ];

    const error = await uploadVideoViaPresignedUrl('file:///v.mp4', 'u1', { title: 'T' })
      .then(() => null)
      .catch((e) => e as Error & { finalizePayload?: Record<string, unknown> });

    expect(error).not.toBeNull();
    // The transfer succeeded — the payload lets callers queue a finalize-only
    // retry (idempotent server-side) instead of re-uploading the file.
    expect(error!.finalizePayload).toMatchObject({ r2VideoKey: 'key-1', title: 'T' });
    expect(MockXHR.instances).toHaveLength(1);
  }, 20_000);

  it('finalizeVideoUploadOnly re-sends just the finalize call (no file transfer)', async () => {
    const result = await finalizeVideoUploadOnly({ r2VideoKey: 'key-9', title: 'T' });

    expect(result.success).toBe(true);
    expect(finalizeCalls[0].r2VideoKey).toBe('key-9');
    expect(MockXHR.instances).toHaveLength(0); // no XHR — nothing re-uploaded
    expect(presignCount).toBe(0);
  });

  it('never retries after user cancellation', async () => {
    const controller = new AbortController();
    const promise = uploadVideoViaPresignedUrl(
      'file:///v.mp4',
      'u1',
      { title: 'T' },
      { signal: controller.signal },
    );

    // Wait for presign to resolve and the XHR to be created, then cancel.
    await new Promise((r) => setTimeout(r, 0));
    expect(MockXHR.instances).toHaveLength(1);
    controller.abort();

    await expect(promise).rejects.toThrow(/cancelled/i);
    expect(presignCount).toBe(1); // no fresh presign after a cancel
    expect(MockXHR.instances).toHaveLength(1);
  });
});
