import { env, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { buildHtmlTemplate, buildTextTemplate } from '../src/mail/templates';
import { createApiKey, validateApiKey } from '../src/auth';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('medilive-utils-api', () => {
  // ── Template Tests ──
  describe('Email Templates', () => {
    const templateData = {
      title: 'Welcome to MediLive',
      body: 'Thank you for signing up!\nWe are excited to have you.',
      ctaText: 'Get Started',
      ctaUrl: 'https://medilive.pl/dashboard',
      senderName: 'MediLive Team',
    };

    it('builds an HTML template with all sections', () => {
      const html = buildHtmlTemplate(templateData);

      // Should contain key sections
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Welcome to MediLive');
      expect(html).toContain('Thank you for signing up!');
      expect(html).toContain('Get Started');
      expect(html).toContain('https://medilive.pl/dashboard');
      expect(html).toContain('MediLive Team');
    });

    it('builds an HTML template without optional CTA', () => {
      const data = { ...templateData, ctaText: undefined, ctaUrl: undefined };
      const html = buildHtmlTemplate(data);

      expect(html).toContain('Welcome to MediLive');
      expect(html).not.toContain('Get Started');
      expect(html).not.toContain('href=');
    });

    it('escapes HTML in user-provided text', () => {
      const data = {
        ...templateData,
        title: '<script>alert("xss")</script>',
        body: 'User input & special chars',
      };
      const html = buildHtmlTemplate(data);

      // HTML should be escaped
      const escapedScript = '<script>alert("xss")</script>';
      const escapedAmp = 'User input & special chars';
      expect(html).not.toContain('<script>');
      expect(html).toContain(escapedScript);
      expect(html).toContain(escapedAmp);
    });

    it('builds a plaintext template', () => {
      const text = buildTextTemplate(templateData);

      expect(text).toContain('Welcome to MediLive');
      expect(text).toContain('Thank you for signing up!');
      expect(text).toContain('Get Started — https://medilive.pl/dashboard');
      expect(text).toContain('Sent by MediLive Team');
    });

    it('uses shadcn color tokens in HTML', () => {
      const html = buildHtmlTemplate(templateData);

      // Verify shadcn colors are present
      expect(html).toContain('#0f172a'); // foreground
      expect(html).toContain('#18181b'); // primary
      expect(html).toContain('#fafafa'); // primary-foreground
      expect(html).toContain('#f1f5f9'); // muted
      expect(html).toContain('#64748b'); // muted-foreground
      expect(html).toContain('#e2e8f0'); // border
    });
  });

  // ── API Key Management Tests ──
  describe('API Key Management', () => {
    it('creates and validates an API key', async () => {
      const key = await createApiKey(env.KEYS_STORE);
      expect(key).toMatch(/^mlu_[0-9a-f]{64}$/);

      const payload = await validateApiKey(key, env.KEYS_STORE);
      expect(payload).not.toBeNull();
      expect(payload!.key).toBe(key);
      expect(payload!.expires_at).toBeGreaterThan(payload!.created_at);
    });

    it('returns null for a non-existent key', async () => {
      const payload = await validateApiKey('mlu_nonexistent', env.KEYS_STORE);
      expect(payload).toBeNull();
    });

    it('generates unique keys each time', async () => {
      const key1 = await createApiKey(env.KEYS_STORE);
      const key2 = await createApiKey(env.KEYS_STORE);

      expect(key1).not.toBe(key2);
    });

    it('creates a key with correct TTL values', async () => {
      const key = await createApiKey(env.KEYS_STORE);
      const payload = await validateApiKey(key, env.KEYS_STORE);

      expect(payload!.expires_at).toBeGreaterThan(payload!.created_at);
      // expires_at should be ~30 days (2,592,000 seconds) after created_at
      const diffExpiry = payload!.expires_at - payload!.created_at;
      expect(diffExpiry).toBeCloseTo(2592000, -2); // Within 100 seconds of 30 days

      // refreshable_until should be ~365 days after created_at
      const diffRefresh = payload!.refreshable_until - payload!.created_at;
      expect(diffRefresh).toBeCloseTo(31536000, -3); // Within 1000 seconds of 365 days
    });
  });

  // ── Health Check Endpoint Test ──
  describe('Health Check', () => {
    it('returns OK on GET /api/v1/health', async () => {
      const response = await SELF.fetch('https://example.com/api/v1/health');
      expect(response.status).toBe(200);

      const body = (await response.json()) as { status: string; service: string };
      expect(body.status).toBe('ok');
      expect(body.service).toBe('medilive-utils-api');
    });
  });

  // ── Mail Send — Auth Protection ──
  describe('Mail send endpoint — auth', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const response = await SELF.fetch('https://example.com/api/v1/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'test@example.com',
          subject: 'Test',
          content: { title: 'Test', body: 'Test body' },
        }),
      });
      expect(response.status).toBe(401);

      const body = (await response.json()) as { success: boolean; error: string };
      expect(body.success).toBe(false);
    });

    it('returns 401 with a malformed Authorization header', async () => {
      const response = await SELF.fetch('https://example.com/api/v1/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic abc123',
        },
        body: JSON.stringify({
          to: 'test@example.com',
          subject: 'Test',
          content: { title: 'Test', body: 'Test body' },
        }),
      });
      expect(response.status).toBe(401);
    });
  });

  // ── Mail Send — Validation ──
  describe('Mail send endpoint — validation', () => {
    it('returns 400 when body is missing required fields', async () => {
      const response = await SELF.fetch('https://example.com/api/v1/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const response = await SELF.fetch('https://example.com/api/v1/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'not-an-email',
          subject: 'Test',
          content: { title: 'Test', body: 'Test' },
        }),
      });
      expect(response.status).toBe(400);
    });
  });
});