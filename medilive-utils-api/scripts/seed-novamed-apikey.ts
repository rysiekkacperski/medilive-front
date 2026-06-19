/**
 * Generates an API key for the NovaMed tenant and writes it to KV.
 *
 * Usage: npx tsx scripts/seed-novamed-apikey.ts
 */

const NOVAMED_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const KV_KEY_PREFIX = 'apikey:';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function generateKeyString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mlu_${hex}`;
}

const now = Math.floor(Date.now() / 1000);

const payload = {
  key: generateKeyString(),
  tenant_id: NOVAMED_TENANT_ID,
  created_at: now,
  expires_at: now + THIRTY_DAYS_SECONDS,
  refreshable_until: now + ONE_YEAR_SECONDS,
};

console.log(`Plaintext API key:  ${payload.key}`);
console.log(`Tenant ID:          ${payload.tenant_id}`);
console.log(`Created at:         ${new Date(payload.created_at * 1000).toISOString()}`);
console.log(`Expires at:         ${new Date(payload.expires_at * 1000).toISOString()}`);
console.log(`Refreshable until:  ${new Date(payload.refreshable_until * 1000).toISOString()}`);
console.log();
console.log('--- Copy and run the following command ---');
console.log();
console.log(
  `npx wrangler kv:key put --binding=KEYS_STORE "${KV_KEY_PREFIX}${payload.key}" '${JSON.stringify(payload)}'`,
);