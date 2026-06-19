import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateVisitRequestSchema } from '../types';
import type { Env, Variables } from '../types';
import { createVisit } from './create';
import { apiKeyAuthMiddleware } from '../auth';

const visitRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All visit routes require API key auth
visitRoutes.use('*', apiKeyAuthMiddleware);

/**
 * POST /api/v1/visits
 *
 * Create a new visit entry in the D1 database.
 *
 * Body:
 * {
 *   "user-id": "uuid",
 *   "institution-id": "uuid",
 *   "doctor-id": "uuid",
 *   "type": "string"
 * }
 */
visitRoutes.post('/', zValidator('json', CreateVisitRequestSchema), async (c) => {
  const {
    'user-id': userId,
    'institution-id': institutionId,
    'doctor-id': doctorId,
    'phone-number': phoneNumber,
    'email': email,
    'type': type
  } = c.req.valid('json');

  const tenantId = c.var.tenantId;

  if (!c.env.DB) {
    console.error('D1 database binding is not configured');
    return c.json(
      { success: false, error: 'Server configuration error: database not available.' },
      { status: 500 },
    );
  }

  const result = await createVisit(c.env.DB, { userId, institutionId, doctorId, phoneNumber, email, type, tenantId });

  if (result.success) {
    return c.json(result, { status: 201 });
  }

  return c.json(result, { status: 500 });
});

export { visitRoutes };