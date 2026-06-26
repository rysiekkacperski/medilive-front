import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import type { Env, Variables } from './types';
import { mailRoutes } from './mail/routes';
import { visitRoutes } from './visit/routes';
import { smsRoutes } from './sms/routes';

//  CORS configuration 
const CORS_ALLOW_ORIGINS = ['https://medilive.pl', 'http://localhost:5173'];

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

//  Global Middleware 
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

//  Health check (public) 
app.get('/api/v1/health', (c) => {
  return c.json({ status: 'ok', service: 'medilive-utils-api', timestamp: Date.now() });
});

//  Mount routes 
app.route('/api/v1/mail', mailRoutes);
app.route('/api/v1/visits', visitRoutes);
app.route('/api/v1/sms', smsRoutes);

//  404 catch-all 
app.notFound((c) => {
  return c.json(
    { success: false, error: `Not Found: ${c.req.method} ${c.req.path}` },
    { status: 404 },
  );
});

//  Global error handler 
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