import { createParser, type EventSourceMessage, type ParseError } from "eventsource-parser";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { createJwt, verifyJwt } from "./jwt";
import type {
  DifyPayload,
  ChatCredentialsData,
  DifyStreamEvent,
} from "./types";
import { SendMessageRequestSchema, type Env } from "./types";

// ── CORS configuration ──
const CORS_ALLOW_ORIGINS = ["https://medilive.pl", "https://demo.medilive.pl", "http://localhost:5173"];

const app = new Hono<{ Bindings: Env }>();

// ── Global Middleware ──
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: CORS_ALLOW_ORIGINS,
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

/**
 * Generate a simple UUID v4 using the Web Crypto API.
 */
function uuidv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * POST /send-message
 *
 * Sends a chat message to Dify via streaming SSE.
 * Expects JSON body: { messages, jwt?, dify_workflow_id }
 * Returns a Vercel AI SDK v6-compatible SSE stream.
 */
/**
 * Validates a Turnstile token against Cloudflare's siteverify endpoint.
 * Returns true if the token is valid, false otherwise.
 * Skips validation if TURNSTILE_SECRET_KEY is not configured (graceful degradation).
 */
async function validateTurnstile(token: string, secret: string): Promise<boolean> {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData },
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    console.error("Turnstile siteverify request failed");
    return false;
  }
}

app.post("/send-message", zValidator("json", SendMessageRequestSchema), async (c) => {
  const { messages, jwt, dify_workflow_id, turnstileToken } = c.req.valid("json");

  // Validate environment
  const { SERVER_SECRET, DIFY_API_KEY, DIFY_API_URL, KEYS_STORE, TURNSTILE_SECRET_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET } = c.env;

  // ── Turnstile validation (mandatory when secret is configured) ──
  if (TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return c.json(
        { error: "Turnstile token is required." },
        { status: 403 },
      );
    }
    const isValid = await validateTurnstile(turnstileToken, TURNSTILE_SECRET_KEY);
    if (!isValid) {
      return c.json(
        { error: "Turnstile verification failed." },
        { status: 403 },
      );
    }
  }

  if (!SERVER_SECRET || !DIFY_API_URL) {
    return c.json({ error: "Server configuration error." }, { status: 500 });
  }

  // Resolve API key: KV first, then env fallback
  let apiKey: string | null = null;
  if (KEYS_STORE) {
    try {
      const kvKey = await KEYS_STORE.get(dify_workflow_id);
      if (kvKey) {
        apiKey = kvKey;
      }
    } catch {
      // KV unavailable — fall back to env DIFY_API_KEY
    }
  }
  if (!apiKey) {
    apiKey = DIFY_API_KEY;
  }
  if (!apiKey) {
    return c.json(
      { error: "Server configuration error: no API key available." },
      { status: 500 },
    );
  }

  // Verify JWT (if provided) — extract conversation_id and user_id
  let conversationId: string | undefined;
  let storedUserId: string | undefined;
  if (jwt) {
    const payload = await verifyJwt(jwt, SERVER_SECRET);
    if (payload?.conversation_id) {
      conversationId = payload.conversation_id as string;
    }
    if (payload?.user_id) {
      storedUserId = payload.user_id as string;
    }
    // Invalid/expired JWT is silently ignored — starts a new conversation
  }

  // Generate or reuse user_id — worker is the source of truth
  const userId = storedUserId || uuidv4();

  // Extract latest user message
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) {
    return c.json(
      { error: "No user message found in the conversation." },
      { status: 400 },
    );
  }

  const query =
    lastUserMessage.content ||
    lastUserMessage.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("") ||
    "";

  // Build Dify payload
  const difyPayload: DifyPayload = {
    inputs: {},
    query,
    response_mode: "streaming",
    user: userId,
  };
  if (conversationId) difyPayload.conversation_id = conversationId;
  difyPayload.app_id = dify_workflow_id;

  // Call Dify
  let difyResponse: Response;
  try {
    const difyHeaders: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (CF_ACCESS_CLIENT_ID && CF_ACCESS_CLIENT_SECRET) {
      difyHeaders["CF-Access-Client-Id"] = CF_ACCESS_CLIENT_ID;
      difyHeaders["CF-Access-Client-Secret"] = CF_ACCESS_CLIENT_SECRET;
    }
    difyResponse = await fetch(`${DIFY_API_URL}/v1/chat-messages`, {
      method: "POST",
      headers: difyHeaders,
      body: JSON.stringify(difyPayload),
    });
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

  // Build the SSE pipe
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Stable IDs for this response
  const messageId = uuidv4();
  const textId = uuidv4();

  /**
   * Writes one SSE event to the pipe.
   * Vercel AI SDK v6 Data Stream Protocol: `data: <JSON>\n\n`
   */
  const sse = (payload: object): Promise<void> =>
    writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  // v6 event helpers
  const sendMessageStart = () =>
    sse({ type: "start", messageId });

  // Text block lifecycle
  const sendTextStart = () => sse({ type: "text-start", id: textId });
  const sendTextDelta = (delta: string) =>
    sse({ type: "text-delta", id: textId, delta });
  const sendTextEnd = () => sse({ type: "text-end", id: textId });

  // Custom typed data — readable on the client via message.parts
  // (type = 'data-chat-credentials')
  const sendCredentials = (data: ChatCredentialsData) =>
    sse({ type: "data-chat-credentials", data });

  const sendError = (errorText: string) =>
    sse({ type: "error", errorText });

  const sendFinish = async () => {
    await sse({ type: "finish-step" });
    await sse({ type: "finish" });
    // SSE stream termination marker
    await writer.write(encoder.encode("data: [DONE]\n\n"));
  };

  // Stream Dify → client
  // Runs fully async behind the returned Response
  (async () => {
    let hasSentCredentials = false;

    await sendMessageStart();
    await sendTextStart();

    const parser = createParser({
      onError(error: ParseError) {
        console.error("eventsource-parser error:", error);
      },

      onEvent(event: EventSourceMessage) {
        try {
          const data = JSON.parse(event.data) as DifyStreamEvent;

          if (data.event === "message") {
            // Send JWT credentials on the first token of a new conversation
            if (!conversationId && !hasSentCredentials && data.conversation_id) {
              // Create a JWT embedding the Dify conversation_id and user_id
              createJwt(
                { conversation_id: data.conversation_id, user_id: userId },
                SERVER_SECRET,
                86400, // 24h expiry
              ).then((token) => {
                sendCredentials({
                  type: "chat-credentials",
                  jwt: token,
                  user_id: userId,
                });
              });
              hasSentCredentials = true;
            }

            // Each Dify token → one text-delta event
            sendTextDelta(data.answer);
          } else if (
            data.event === "node_started" ||
            data.event === "workflow_started"
          ) {
            const title =
              data.data?.title as string | undefined;
            if (title) {
              sse({ type: "data-node-status", data: { title } });
            }
          } else if (data.event === "node_finished") {
            const title = data.data?.title as string | undefined;
            sse({ type: "data-node-status", data: { title: null } });

            // Detect CREATE_VISIT node and forward visit ID
            if (title === "CREATE_VISIT") {
              const outputs = data.data?.outputs as { body?: string } | undefined;
              if (outputs?.body) {
                try {
                  const parsed = JSON.parse(outputs.body) as { visit?: { id?: string } };
                  const visitId = parsed?.visit?.id;
                  if (visitId) {
                    sse({ type: "data-visit-created", data: { visitId } });
                  }
                } catch {
                  console.error("Failed to parse CREATE_VISIT outputs.body");
                }
              }
            }
          } else if (data.event === "workflow_finished") {
            sse({ type: "data-node-status", data: { title: null } });
          } else if (data.event === "error") {
            sendError(data.message ?? "Stream Error");
          }
        } catch (err) {
          console.error("Failed to parse inner Dify event JSON", err);
        }
      },
    });

    const reader = difyResponse.body?.getReader();
    if (!reader) {
      await sendError("Failed to initialize stream reader");
      await writer.close();
      return;
    }

    const decoder = new TextDecoder("utf-8");
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          parser.reset({ consume: true });
          break;
        }
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (streamError) {
      console.error("Stream reading interrupted:", streamError);
    } finally {
      reader.releaseLock();
      // Close the text block, then signal message completion, then [DONE]
      await sendTextEnd();
      await sendFinish();
      await writer.close();
    }
  })();

  // Return the readable end immediately — the async block above fills it
  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
});

// ── 404 catch-all ──
app.notFound((c) => {
  return c.json(
    { success: false, error: `Not Found: ${c.req.method} ${c.req.path}` },
    { status: 404 },
  );
});

// ── Global error handler ──
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: "Internal server error.",
    },
    { status: 500 },
  );
});

export default app;