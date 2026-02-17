/**
 * Netlify Edge Function — SSE streaming endpoint
 *
 * Runs on Deno (Edge) which natively supports streaming responses.
 * Replicates the behaviour of sseController.mjs but in a streaming-capable
 * runtime rather than a buffered serverless function.
 */
import postgres from "postgres";

// ── Configuration ──────────────────────────────────────────────
const CONNECTION_TTL_MS = 25_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_EVENTS_PER_FLUSH = 50;

// ── JWT verification (HS256 via Web Crypto) ────────────────────
function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyJWT(
  token: string,
  secret: string
): Promise<{ id: string; exp?: number } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signature = base64UrlDecode(signatureB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );

    // Reject expired tokens
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ── Event flushing ─────────────────────────────────────────────
async function flushEvents(
  sql: postgres.Sql,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  userId: string,
  lastSeq: number
): Promise<number> {
  const events = await sql`
    SELECT seq, type, payload
    FROM "SSEEvent"
    WHERE "userId" = ${userId} AND seq > ${lastSeq}
    ORDER BY seq ASC
    LIMIT ${MAX_EVENTS_PER_FLUSH}
  `;

  for (const event of events) {
    const msg =
      `id: ${event.seq}\n` +
      `event: ${event.type}\n` +
      `data: ${JSON.stringify(event.payload)}\n\n`;
    await writer.write(encoder.encode(msg));
    lastSeq = event.seq;
  }

  return lastSeq;
}

// ── Edge Function handler ──────────────────────────────────────
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const jwtSecret = Deno.env.get("JWT_SECRET");
  if (!jwtSecret) {
    return Response.json(
      { success: false, message: "Server misconfigured" },
      { status: 500 }
    );
  }

  const decoded = await verifyJWT(token, jwtSecret);
  if (!decoded?.id) {
    return Response.json(
      { success: false, message: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const userId = decoded.id;

  // --- Last-Event-ID resumption ---
  let lastSeq = 0;
  const lastEventIdHeader = req.headers.get("last-event-id");
  if (lastEventIdHeader) {
    const parsed = parseInt(lastEventIdHeader, 10);
    if (!isNaN(parsed)) lastSeq = parsed;
  }

  // --- Database ---
  const databaseUrl = Deno.env.get("DATABASE_URL");
  if (!databaseUrl) {
    return Response.json(
      { success: false, message: "Database not configured" },
      { status: 500 }
    );
  }

  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

  // --- SSE stream ---
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Drive the stream in the background (non-blocking)
  (async () => {
    try {
      await writer.write(encoder.encode("retry: 3000\n\n"));
      await writer.write(encoder.encode(": connected\n\n"));

      // Flush any missed events
      lastSeq = await flushEvents(sql, writer, encoder, userId, lastSeq);

      const connectionStart = Date.now();
      let heartbeatCounter = 0;

      while (true) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        // TTL — graceful close
        if (Date.now() - connectionStart >= CONNECTION_TTL_MS) {
          await writer.write(
            encoder.encode('event: reconnect\ndata: {"reason":"ttl"}\n\n')
          );
          break;
        }

        // Heartbeat (every ~10s)
        heartbeatCounter += POLL_INTERVAL_MS;
        if (heartbeatCounter >= HEARTBEAT_INTERVAL_MS) {
          heartbeatCounter = 0;
          await writer.write(
            encoder.encode(`:heartbeat ${Date.now()}\n\n`)
          );
        }

        // Poll for new events
        try {
          lastSeq = await flushEvents(sql, writer, encoder, userId, lastSeq);
        } catch (err) {
          console.error("[SSE Edge] Poll error:", err);
        }
      }
    } catch (err) {
      // Client disconnected — expected
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("WritableStream")) {
        console.error("[SSE Edge] Stream error:", msg);
      }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
      try { await sql.end(); } catch { /* ignore */ }
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

export const config = { path: "/api/sse/stream" };
