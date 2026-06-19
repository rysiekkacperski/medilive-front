import { createMiddleware } from 'hono/factory';
import type { Env, Variables, ApiKeyPayload } from './types';

// KV key prefix to namespace our API keys
const KV_KEY_PREFIX = 'apikey:';

// Duration constants
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 2,592,000
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60; // 31,536,000

/**
 * Generate a cryptographically random API key string.
 * Format: mlu_<32 random hex chars>
 */
function generateKeyString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mlu_${hex}`;
}

/**
 * Create a new API key and store it in KV.
 *
 * @returns The plaintext key (only returned once — caller must present to user).
 */
export async function createApiKey(kv: KVNamespace, tenantId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload: ApiKeyPayload = {
    key: generateKeyString(),
    tenant_id: tenantId,
    created_at: now,
    expires_at: now + THIRTY_DAYS_SECONDS,
    refreshable_until: now + ONE_YEAR_SECONDS,
  };

  await kv.put(`${KV_KEY_PREFIX}${payload.key}`, JSON.stringify(payload), {
    expirationTtl: ONE_YEAR_SECONDS, // Auto-cleanup after 1 year
  });

  console.log(`Created API key: ${payload.key.substring(0, 8)}... (expires in 30 days)`);

  return payload.key;
}

/**
 * Refresh an existing API key — extend its expires_at by another 30 days.
 * The key must still be within its refreshable_until window (1 year from creation).
 *
 * @returns The new expiry timestamp (Unix seconds), or null if refresh is not allowed.
 */
export async function refreshApiKey(
  key: string,
  kv: KVNamespace,
): Promise<number | null> {
  const raw = await kv.get(`${KV_KEY_PREFIX}${key}`);
  if (!raw) return null;

  const payload: ApiKeyPayload = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  // Cannot refresh if the key is past its refreshable_until window
  if (now > payload.refreshable_until) {
    console.log(`API key ${key.substring(0, 8)}... attempt to refresh past refreshable_until`);
    return null;
  }

  // Extend expiry by 30 days from now
  const newExpiry = now + THIRTY_DAYS_SECONDS;
  payload.expires_at = newExpiry;

  // Calculate remaining TTL for KV (capped at the refreshable_until horizon)
  const remainingTtl = payload.refreshable_until - now;

  await kv.put(`${KV_KEY_PREFIX}${key}`, JSON.stringify(payload), {
    expirationTtl: Math.max(remainingTtl, 1), // At least 1 second
  });

  console.log(`Refreshed API key: ${key.substring(0, 8)}... (new expiry: ${new Date(newExpiry * 1000).toISOString()})`);

  return newExpiry;
}

/**
 * Validate an API key against KV storage.
 *
 * Returns the parsed payload if valid, null otherwise.
 */
export async function validateApiKey(
  key: string,
  kv: KVNamespace,
): Promise<ApiKeyPayload | null> {
  const raw = await kv.get(`${KV_KEY_PREFIX}${key}`);
  if (!raw) {
    console.log(`API key ${key.substring(0, 8)}... not found in KV`);
    return null;
  }

  let payload: ApiKeyPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error(`Failed to parse API key payload for ${key.substring(0, 8)}...`);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (now > payload.expires_at) {
    console.log(`API key ${key.substring(0, 8)}... expired at ${new Date(payload.expires_at * 1000).toISOString()}`);
    return null;
  }

  return payload;
}

/**
 * Revoke an API key by deleting it from KV.
 */
export async function revokeApiKey(key: string, kv: KVNamespace): Promise<boolean> {
  try {
    await kv.delete(`${KV_KEY_PREFIX}${key}`);
    console.log(`Revoked API key: ${key.substring(0, 8)}...`);
    return true;
  } catch {
    console.error(`Failed to revoke API key: ${key.substring(0, 8)}...`);
    return false;
  }
}

/**
 * Hono middleware — extracts and validates the API key from
 * the `Authorization: Bearer <key>` header.
 *
 * On success, sets `c.var.apiKey` to the validated key string.
 * On failure, returns a 401 JSON response.
 */
export const apiKeyAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: 'Missing or invalid Authorization header. Expected: Bearer <api_key>' },
      { status: 401 },
    );
  }

  const key = authHeader.slice(7).trim();

  if (!key) {
    return c.json(
      { success: false, error: 'API key is empty.' },
      { status: 401 },
    );
  }

  const payload = await validateApiKey(key, c.env.KEYS_STORE);

  if (!payload) {
    return c.json(
      { success: false, error: 'Invalid or expired API key.' },
      { status: 401 },
    );
  }

  // Store the validated key and tenant for downstream handlers
  c.set('apiKey', key);
  c.set('tenantId', payload.tenant_id);

  await next();
});
