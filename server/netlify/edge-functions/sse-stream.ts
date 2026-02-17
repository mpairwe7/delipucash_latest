/**
 * Netlify Edge Function — SSE streaming bridge
 *
 * Runs on Deno (Edge) which natively supports streaming responses.
 * Delegates event fetching to the Express function via /api/sse/poll
 * (no database driver needed in the edge runtime).
 */

// ── Configuration ──────────────────────────────────────────────
const CONNECTION_TTL_MS = 25_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 3_000;

// ── Edge Function handler ──────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, message: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Resolve the origin for internal poll requests.
  // On Netlify, the edge function shares the same origin as the site.
  const origin = new URL(req.url).origin;
  const pollBase = `${origin}/.netlify/functions/api/api/sse/poll`;

  // Last-Event-ID resumption
  let lastSeq = 0;
  const lastEventIdHeader = req.headers.get("last-event-id");
  if (lastEventIdHeader) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) lastSeq = parsed;
  }

  // ── SSE stream via TransformStream ───────────────────────────
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const write = (text: string) => writer.write(encoder.encode(text));

  // Drive the stream in the background (non-blocking)
  (async () => {
    try {
      await write("retry: 3000\n\n");
      await write(": connected\n\n");

      // Initial flush
      lastSeq = await pollAndFlush(pollBase, authHeader, lastSeq, write);

      const connectionStart = Date.now();
      let heartbeatCounter = 0;

      while (true) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        // TTL — graceful close
        if (Date.now() - connectionStart >= CONNECTION_TTL_MS) {
          await write('event: reconnect\ndata: {"reason":"ttl"}\n\n');
          break;
        }

        // Heartbeat
        heartbeatCounter += POLL_INTERVAL_MS;
        if (heartbeatCounter >= HEARTBEAT_INTERVAL_MS) {
          heartbeatCounter = 0;
          await write(`:heartbeat ${Date.now()}\n\n`);
        }

        // Poll Express function for new events
        try {
          lastSeq = await pollAndFlush(pollBase, authHeader, lastSeq, write);
        } catch (err) {
          console.error("[SSE Edge] Poll error:", err);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("WritableStream")) {
        console.error("[SSE Edge] Stream error:", msg);
      }
    } finally {
      try {
        await writer.close();
      } catch {
        /* already closed */
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Fetch events from the Express /api/sse/poll endpoint and write them as SSE.
 * Returns the updated lastSeq.
 */
async function pollAndFlush(
  pollBase: string,
  authHeader: string,
  lastSeq: number,
  write: (text: string) => Promise<void>
): Promise<number> {
  const res = await fetch(`${pollBase}?lastSeq=${lastSeq}`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) return lastSeq;

  const data = await res.json();
  const events: Array<{ seq: number; type: string; payload: unknown }> =
    data.events ?? [];

  for (const event of events) {
    const msg =
      `id: ${event.seq}\n` +
      `event: ${event.type}\n` +
      `data: ${JSON.stringify(event.payload)}\n\n`;
    await write(msg);
    lastSeq = event.seq;
  }

  return lastSeq;
}

export const config = { path: "/api/sse/stream" };
