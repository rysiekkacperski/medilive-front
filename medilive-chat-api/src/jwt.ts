/**
 * Base64url encode a string or ArrayBuffer.
 */
function base64urlEncode(input: string | ArrayBuffer): string {
  let bytes: Uint8Array;

  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Base64url decode a string.
 */
function base64urlDecode(input: string): string {
  input = input.replace(/-/g, "+").replace(/_/g, "/");
  while (input.length % 4) {
    input += "=";
  }
  return atob(input);
}

/**
 * Create a signed JWT using HMAC-SHA256.
 *
 * @param payload - The JSON-serializable payload to embed in the token.
 * @param secret - The HMAC shared secret.
 * @param expiresInSeconds - Token lifetime in seconds (default 86400 = 24h).
 * @returns A signed JWT string.
 */
export async function createJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 86400,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  // Import the secret key
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  const signatureEncoded = base64urlEncode(signature);

  return `${signingInput}.${signatureEncoded}`;
}

/**
 * Verify a JWT and decode its payload.
 *
 * @param token - The JWT string to verify.
 * @param secret - The HMAC shared secret.
 * @returns The decoded payload object, or null if verification fails or token is expired.
 */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

  // Verify the signature
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  const signatureBytes = Uint8Array.from(
    base64urlDecode(signatureEncoded),
    (c) => c.charCodeAt(0),
  );

  let isValid: boolean;
  try {
    isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(signingInput),
    );
  } catch {
    return null;
  }

  if (!isValid) {
    return null;
  }

  // Decode and check expiry
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64urlDecode(payloadEncoded));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && (payload.exp as number) < now) {
    return null; // Expired
  }

  return payload;
}