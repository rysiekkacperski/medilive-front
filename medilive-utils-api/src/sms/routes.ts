import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SMSAPI } from 'smsapi';
import { SmsSendRequestSchema } from '../types';
import type { Env, Variables } from '../types';
import { sendVisitSms } from './send';
import { apiKeyAuthMiddleware } from '../auth';

const smsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

smsRoutes.use('*', apiKeyAuthMiddleware);

/**
 * POST /api/v1/sms/send
 *
 * Send SMS for an existing visit.
 * SMS is skipped if another visit with the same phone_number
 * exists for this tenant in the last 24 hours.
 *
 * Body:
 * { "visit-id": "uuid" }
 */
smsRoutes.post('/', zValidator('json', SmsSendRequestSchema), async (c) => {
  const { 'visit-id': visitId } = c.req.valid('json');
  const tenantId = c.var.tenantId;

  if (!c.env.DB) {
    return c.json(
      { success: false, error: 'Server configuration error: database not available.' },
      { status: 500 },
    );
  }

  if (!c.env.SMSAPI_TOKEN) {
    return c.json(
      { success: false, error: 'Server configuration error: SMSAPI_TOKEN not set.' },
      { status: 500 },
    );
  }

  const smsapi = new SMSAPI(c.env.SMSAPI_TOKEN);
  const senderName = c.env.SENDER_NAME || 'MediLive';

  const result = await sendVisitSms(c.env.DB, visitId, tenantId, smsapi, senderName);

  if (result.success) {
    return c.json(result, { status: 200 });
  }

  if (result.error === 'Visit not found.') {
    return c.json(result, { status: 404 });
  }

  return c.json(result, { status: 500 });
});

export { smsRoutes };