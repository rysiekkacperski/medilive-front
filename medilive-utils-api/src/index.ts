import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { zValidator } from '@hono/zod-validator';
import { SendMailRequestSchema } from './types';
import type { Env, Variables } from './types';
import { sendEmail } from './mail/send';
import { apiKeyAuthMiddleware } from './auth';

// ── CORS configuration ──
const CORS_ALLOW_ORIGINS = ['https://medilive.pl', 'http://localhost:5173'];

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Global Middleware ──
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: CORS_ALLOW_ORIGINS,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// ── Health check (public) ──
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', service: 'medilive-utils-api', timestamp: Date.now() });
});

// ── Mail Routes (protected) ──
const mailRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All mail routes require API key auth
mailRoutes.use('*', apiKeyAuthMiddleware);

/**
 * POST /api/v1/mail/send
 *
 * Send a transactional email using the shadcn-themed template.
 *
 * Authorization: Bearer <api_key>
 *
 * Body:
 * {
 *   "to": "recipient@example.com",
 *   "subject": "Your Subject",
 *   "content": {
 *     "title": "Welcome!",
 *     "body": "Thanks for signing up...",
 *     "ctaText": "Get Started",       // optional
 *     "ctaUrl": "https://..."         // optional
 *   },
 *   "senderName": "Custom Name"       // optional override
 * }
 */
mailRoutes.post('/send', zValidator('json', SendMailRequestSchema), async (c) => {
  const body = c.req.valid('json');

  const senderEmail = c.env.SENDER_EMAIL;
  const defaultSenderName = c.env.SENDER_NAME || 'MediLive';

  if (!senderEmail) {
    console.error('SENDER_EMAIL environment variable is not configured');
    return c.json(
      { success: false, error: 'Server configuration error: sender email not set.' },
      { status: 500 },
    );
  }

  const result = await sendEmail(body, c.env, senderEmail, defaultSenderName);

  if (result.success) {
    return c.json(result, { status: 200 });
  }

  // Map error codes to appropriate HTTP status
  const status = isClientError(result.code)
    ? 400
    : result.code === 'E_RATE_LIMIT_EXCEEDED'
      ? 429
      : 502;

  return c.json(result, { status });
});

/**
 * Determine if the error code indicates a client-side (4xx) issue.
 */
function isClientError(code?: string): boolean {
  if (!code) return false;
  return [
    'E_VALIDATION_ERROR',
    'E_FIELD_MISSING',
    'E_TOO_MANY_RECIPIENTS',
    'E_SENDER_NOT_VERIFIED',
    'E_RECIPIENT_NOT_ALLOWED',
    'E_RECIPIENT_SUPPRESSED',
    'E_SENDER_DOMAIN_NOT_AVAILABLE',
    'E_CONTENT_TOO_LARGE',
    'E_HEADER_NOT_ALLOWED',
    'E_HEADER_USE_API_FIELD',
    'E_HEADER_VALUE_INVALID',
    'E_HEADER_VALUE_TOO_LONG',
    'E_HEADER_NAME_INVALID',
    'E_HEADERS_TOO_LARGE',
    'E_HEADERS_TOO_MANY',
  ].includes(code);
}

// ── Mount routes ──
app.route('/api/v1/mail', mailRoutes);

// ── 404 catch-all ──
app.notFound((c) => {
  return c.json(
    { success: false, error: `Not Found: ${c.req.method} ${c.req.path}` },
    { status: 404 },
  );
});

// ── Global error handler ──
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      success: false,
      error: 'Internal server error.',
      ...(c.env as Env & { ENVIRONMENT?: string }).ENVIRONMENT === 'development'
        ? { details: err.message }
        : {},
    },
    { status: 500 },
  );
});

export default app;