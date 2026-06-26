import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { verifyJwt } from "./jwt";
import { uuidv4 } from "./lib/uuid";
import { CORS_ALLOW_ORIGINS, SSE_HEADERS } from "./lib/constants";
import { checkRateLimit } from "./middleware/rate-limit";
import { validateTurnstile } from "./services/turnstile";
import {
  resolveApiKey,
  buildDifyPayload,
  callDify,
  extractQuery,
} from "./services/dify";
import { streamDifyToClient } from "./streaming/dify-to-client";
import { SendMessageRequestSchema, type Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", logger());
app.use("*",
  cors({
    origin: CORS_ALLOW_ORIGINS,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

app.post("/send-message", zValidator("json", SendMessageRequestSchema), async (c) => {
    const { messages, jwt, dify_workflow_id, turnstileToken } = c.req.valid("json");
    const {
      SERVER_SECRET,
      DIFY_API_URL,
      TURNSTILE_SECRET_KEY,
      CF_ACCESS_CLIENT_ID,
      CF_ACCESS_CLIENT_SECRET,
    } = c.env;

    // Basic config check — these must be set via wrangler secrets
    if (!SERVER_SECRET || !DIFY_API_URL) {
      return c.json({ error: "Server configuration error." }, { status: 500 });
    }

    // Get the real client IP (Cloudflare injects this header)
    const clientIp = c.req.header("CF-Connecting-IP") ||
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "unknown";
    const rateLimitResult = await checkRateLimit(clientIp, c.env);
    if (rateLimitResult.limited) {
      return rateLimitResult.response;
    }

    // If the client sent a JWT with conversation_id + user_id, we trust it
    // and skip Turnstile — the JWT proves they already passed it once.
    let conversationId: string | undefined;
    let storedUserId: string | undefined;
    let hasValidJwt = false;

    if (jwt) {
      const payload = await verifyJwt(jwt, SERVER_SECRET);
      if (payload?.conversation_id && payload?.user_id) {
        conversationId = payload.conversation_id as string;
        storedUserId = payload.user_id as string;
        hasValidJwt = true;
      }
    }

    // Only check Turnstile for first messages (no valid JWT yet)
    if (!hasValidJwt && TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return c.json(
          { error: "Turnstile token is required." },
          { status: 403 },
        );
      }
      const isValid = await validateTurnstile(
        turnstileToken,
        TURNSTILE_SECRET_KEY,
      );
      if (!isValid) {
        return c.json(
          { error: "Turnstile verification failed." },
          { status: 403 },
        );
      }
    }

    // Resolve Dify API key — per-workflow KV key, env-level fallback
    const apiKey = await resolveApiKey(dify_workflow_id, c.env);
    if (!apiKey) {
      return c.json(
        { error: "Server configuration error: no API key available." },
        { status: 500 },
      );
    }

    // Worker is the source of truth for userId
    const userId = storedUserId || uuidv4();

    const query = extractQuery(messages);
    if (!query) {
      return c.json(
        { error: "No user message found in the conversation." },
        { status: 400 },
      );
    }

    // Call Dify
    const difyPayload = buildDifyPayload(
      query,
      userId,
      conversationId,
      dify_workflow_id,
    );
    let difyResponse: Response;
    try {
      difyResponse = await callDify(
        difyPayload,
        apiKey,
        DIFY_API_URL,
        CF_ACCESS_CLIENT_ID,
        CF_ACCESS_CLIENT_SECRET,
      );
    } catch {
      return c.json(
        { error: "Upstream AI provider is unreachable." },
        { status: 502 },
      );
    }

    if (!difyResponse.ok) {
      const details = await difyResponse.text();
      return c.json(
        { error: `Provider Error: ${difyResponse.statusText}`, details },
        difyResponse.status as 200 | 400 | 401 | 403 | 404 | 500 | 502,
      );
    }

    // Stream Dify to client via SSE
    const { readable, writable } = new TransformStream();
    streamDifyToClient(
      difyResponse,
      SERVER_SECRET,
      conversationId,
      userId,
      writable,
    );

    return new Response(readable, {
      status: 200,
      headers: SSE_HEADERS,
    });
  },
);

// 404 catch-all
app.notFound((c) => {
  return c.json(
    { success: false, error: `Not Found: ${c.req.method} ${c.req.path}` },
    { status: 404 },
  );
});

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { success: false, error: "Internal server error." },
    { status: 500 },
  );
});

export default app;