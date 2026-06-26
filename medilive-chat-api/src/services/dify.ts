import type { DifyPayload } from "../types";
import type { Env } from "../types";

// Try KV first (per-workflow keys), fall back to the env-level DIFY_API_KEY.
// If both are missing, returns null — caller handles the 500.
export async function resolveApiKey(
  workflowId: string,
  env: Env,
): Promise<string | null> {
  if (env.KEYS_STORE) {
    try {
      const kvKey = await env.KEYS_STORE.get(workflowId);
      if (kvKey) return kvKey;
    } catch {
      // KV unavailable, return env-level key
    }
  }
  return env.DIFY_API_KEY || null;
}

// Build the JSON body Dify expects for a streaming chat request.
export function buildDifyPayload(
  query: string,
  userId: string,
  conversationId: string | undefined,
  app_id: string,
): DifyPayload {
  const payload: DifyPayload = {
    inputs: {},
    query,
    response_mode: "streaming",
    user: userId,
  };
  if (conversationId) payload.conversation_id = conversationId;
  payload.app_id = app_id;
  return payload;
}

// POST to Dify's chat-messages endpoint.
// If CF Access headers are configured, they get forwarded too
// (Dify sits behind Cloudflare Zero Trust).
export async function callDify(
  payload: DifyPayload,
  apiKey: string,
  difyApiUrl: string,
  cfClientId?: string,
  cfClientSecret?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (cfClientId && cfClientSecret) {
    headers["CF-Access-Client-Id"] = cfClientId;
    headers["CF-Access-Client-Secret"] = cfClientSecret;
  }

  return fetch(`${difyApiUrl}/v1/chat-messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

// Pull the text out of the latest user message.
// The AI SDK can send content as a plain string or as an array of parts.
export function extractQuery(
  messages: Array<{
    role: string;
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>,
): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";

  if (lastUser.content) return lastUser.content;

  if (lastUser.parts) {
    return lastUser.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
  }

  return "";
}