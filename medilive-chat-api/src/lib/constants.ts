// Origins allowed to hit this API
export const CORS_ALLOW_ORIGINS = [
  "https://medilive.pl",
  "https://demo.medilive.pl",
  "http://localhost:5173",
];

export const DAILY_LIMIT = 50;
export const DAILY_TTL = 86400; // 24h
export const RATE_LIMIT_PREFIX = "rl:";

// Response headers for the SSE stream (Vercel AI SDK v6 data stream protocol)
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "x-vercel-ai-ui-message-stream": "v1",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
} as const;