import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SendMailRequestSchema } from '../types';
import type { Env, Variables } from '../types';
import { sendEmail } from './send';
import { apiKeyAuthMiddleware } from '../auth';

const mailRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

mailRoutes.use('*', apiKeyAuthMiddleware);

/**
 * POST /api/v1/mail/send
 *
 * Send a transactional email using Amazon SES SMTP.
 *
 * Authorization: Bearer <api_key>
 *
 * Body:
 * {
 *   "to": "recipient@example.com",
 *   "senderEmail": "noreply@medilive.pl",
 *   "senderName": "MediLive",
 *   "subject": "Your Subject",
 *   "content": {
 *     "title": "Welcome!",
 *     "body": "Thanks for signing up...",
 *     "ctaText": "Get Started",
 *     "ctaUrl": "https://..."
 *   }
 * }
 */
mailRoutes.post('/', zValidator('json', SendMailRequestSchema), async (c) => {
  const body = c.req.valid('json');

  if (!c.env.SMTP_HOST || !c.env.SMTP_USER || !c.env.SMTP_PASS) {
    console.error('SMTP configuration is not complete');
    return c.json(
      { success: false, error: 'Server configuration error: SMTP not configured.' },
      { status: 500 },
    );
  }

  const smtpPort = parseInt(c.env.SMTP_PORT || '587', 10);

  const result = await sendEmail(
    body,
    c.env.SMTP_HOST,
    smtpPort,
    c.env.SMTP_USER,
    c.env.SMTP_PASS,
  );

  if (result.success) {
    return c.json(result, { status: 200 });
  }

  return c.json(result, { status: 502 });
});

export { mailRoutes };