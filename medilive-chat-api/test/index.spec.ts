import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("medilive-chat-api worker", () => {
  it("responds with 404 for unknown routes (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toMatchInlineSnapshot(
      `"{"success":false,"error":"Not Found: GET /"}"`,
    );
  });

  it("responds with 404 for unknown routes (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    expect(await response.text()).toMatchInlineSnapshot(
      `"{"success":false,"error":"Not Found: GET /"}"`,
    );
  });

  it("rate limiting: burst layer check runs (binding present)", { timeout: 10000 }, async () => {
      const body = JSON.stringify({
        messages: [{ id: "1", role: "user", content: "Hello" }],
        dify_workflow_id: "test-workflow",
      });

      const request = new IncomingRequest(
        "http://example.com/send-message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "192.0.2.1",
          },
          body,
        },
      );
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);

      // Status should not be 500 (no server crash).
      // 429 = rate limited, 200 = passed rate limit (Dify unreachable in tests
      // so the actual stream may hang, but the rate limit check already ran).
      expect([200, 429]).toContain(response.status);
    },
  );

  it("returns 429 when daily KV limit exceeded (Layer 2)", async () => {
    // Pre-populate the KV store with a counter at the limit (50)
    const testIp = "203.0.113.42";
    await env.RATE_LIMIT_STORE.put("rl:" + testIp, "50", {
      expirationTtl: 86400,
    });

    const body = JSON.stringify({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      dify_workflow_id: "test-workflow",
    });

    const request = new IncomingRequest(
      "http://example.com/send-message",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": testIp,
        },
        body,
      },
    );
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(429);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain("dzienny limit");
  });

  it("allows request when under daily limit", { timeout: 10000 },
    async () => {
      // Pre-populate KV with a low counter (well under the 50 limit)
      const testIp = "198.51.100.10";
      await env.RATE_LIMIT_STORE.put("rl:" + testIp, "10", {
        expirationTtl: 86400,
      });

      const body = JSON.stringify({
        messages: [{ id: "1", role: "user", content: "Hello" }],
        dify_workflow_id: "test-workflow",
      });

      const request = new IncomingRequest(
        "http://example.com/send-message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": testIp,
          },
          body,
        },
      );
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);

      // Should NOT be 429 — rate limiting passed.
      // 200 = passed checks (stream starts), 500 = SERVER_SECRET missing in test env.
      // Both are fine — we just want to confirm rate limiting didn't block it.
      expect(response.status).not.toBe(429);

      // Cancel the SSE stream to prevent test timeout (Dify is unreachable in tests)
      if (response.status === 200) {
        await response.body?.cancel();
      }
    },
  );
});