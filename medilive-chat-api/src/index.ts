import { createParser, type EventSourceMessage, type ParseError } from "eventsource-parser";
import { createJwt, verifyJwt } from "./jwt";
import type {
  DifyPayload,
  ChatCredentialsData,
  DifyStreamEvent,
} from "./types";

/**
 * Environment bindings configured in wrangler.jsonc / Cloudflare dashboard.
 */
export interface Env {
  SERVER_SECRET: string;
  DIFY_API_KEY: string;
  DIFY_API_URL: string;
  KEYS_STORE: KVNamespace;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

// CORS 
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: object, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only accept POST
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, { status: 405 });
    }

    // Validate environment
    const { SERVER_SECRET, DIFY_API_KEY, DIFY_API_URL, KEYS_STORE, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET } = env;

    if (!SERVER_SECRET || !DIFY_API_URL) {
      return jsonResponse({ error: "Server configuration error." }, { status: 500 });
    }

    // Parse body
    interface ChatMessage {
      id: string;
      role: string;
      content?: string;
      parts?: Array<{ type: string; text?: string }>;
    }
    let body: {
      messages: ChatMessage[];
      jwt?: string | null;
      dify_workflow_id?: string;
    };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body provided." }, { status: 400 });
    }

    console.log("Received request with body:", body);

    const { messages, jwt, dify_workflow_id } = body;

    if (!dify_workflow_id) {
      return jsonResponse({ error: "Missing workflow identifier." }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "Messages array is required." }, { status: 400 });
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
      return jsonResponse(
        { error: "Server configuration error: no API key available." },
        { status: 500 },
      );
    }

    // Verify JWT (if provided)
    let conversationId: string | undefined;
    if (jwt) {
      const payload = await verifyJwt(jwt, SERVER_SECRET);
      if (payload?.conversation_id) {
        conversationId = payload.conversation_id as string;
      }
      // Invalid/expired JWT is silently ignored — starts a new conversation
    }

    // Extract latest user message
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return jsonResponse(
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
      user: "anonymous",
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
      return jsonResponse(
        { error: "Upstream AI provider is unreachable." },
        { status: 502 },
      );
    }

    if (!difyResponse.ok) {
      const details = await difyResponse.text();
      return jsonResponse(
        { error: `Provider Error: ${difyResponse.statusText}`, details },
        { status: difyResponse.status },
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
                // Create a JWT embedding the Dify conversation_id
                createJwt(
                  { conversation_id: data.conversation_id },
                  SERVER_SECRET,
                  86400, // 24h expiry
                ).then((token) => {
                  sendCredentials({
                    type: "chat-credentials",
                    jwt: token,
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
            } else if (
              data.event === "node_finished" ||
              data.event === "workflow_finished"
            ) {
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
        ...CORS_HEADERS,
      },
    });
  },
};