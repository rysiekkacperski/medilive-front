import { DAILY_LIMIT, DAILY_TTL, RATE_LIMIT_PREFIX } from "../lib/constants";
import type { Env } from "../types";

// Two-layer rate limiting:
// 1. Burst protection via RATE_LIMITER binding (5 req/10s, per-Cloudflare-location)
// 2. Daily cap via RATE_LIMIT_STORE KV (50/day, global across all locations)
//
// Layer 1 is cheap and always runs. Layer 2 uses KV — if KV is down, we fail open
// (don't block real users just because the counter is unreachable).
//
// Returns a 429 Response if limited, or the current count if allowed.
export async function checkRateLimit(
  ip: string,
  env: Env,
): Promise<{ limited: true; response: Response } | { limited: false }> {
  // Layer 1: burst protection
  const { success: burstOk } = await env.RATE_LIMITER.limit({ key: ip });
  if (!burstOk) {
    return {
      limited: true,
      response: new Response(
        JSON.stringify({
          error: "Przekroczono limit zapytań. Spróbuj ponownie za chwilę.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "10",
          },
        },
      ),
    };
  }

  // Layer 2: daily cap
  try {
    const countStr = await env.RATE_LIMIT_STORE.get(RATE_LIMIT_PREFIX + ip);
    const currentCount = countStr ? parseInt(countStr, 10) : 0;

    if (currentCount >= DAILY_LIMIT) {
      return {
        limited: true,
        response: new Response(
          JSON.stringify({
            error:
              "Przekroczono dzienny limit zapytań (50). Spróbuj ponownie jutro.",
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "86400",
            },
          },
        ),
      };
    }

    // Increment the counter, auto-expires after 24h
    await env.RATE_LIMIT_STORE.put(
      RATE_LIMIT_PREFIX + ip,
      String(currentCount + 1),
      { expirationTtl: DAILY_TTL },
    );
  } catch {
    // KV unavailable — fail open, don't punish real users
    console.error("Rate limit KV store unavailable, allowing request");
  }

  return { limited: false };
}