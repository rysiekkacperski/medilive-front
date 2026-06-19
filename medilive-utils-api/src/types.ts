import { z } from 'zod';
import type { StatusCode } from 'hono/utils/http-status';

// ── Email Content Schema (the structured body for templated emails) ──
export const EmailContentSchema = z.object({
  title: z.string().min(1, 'Email title is required'),
  body: z.string().min(1, 'Email body is required'),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url('CTA URL must be a valid URL').optional(),
});

export type EmailContent = z.infer<typeof EmailContentSchema>;

// ── API Request Schema ──
export const SendMailRequestSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  senderEmail: z.string().email('Invalid sender email address'),
  senderName: z.string().min(1, 'Sender name is required'),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  content: EmailContentSchema,
});

export type SendMailRequest = z.infer<typeof SendMailRequestSchema>;

// ── Visit Request Schema ──
export const CreateVisitRequestSchema = z.object({
  'user-id': z.string().min(1, 'user-id is required'),
  'institution-id': z.string().min(1, 'institution-id is required'),
  'doctor-id': z.string().min(1, 'doctor-id is required'),
  'phone-number': z.string().min(6, 'phone-number is required'),
  email: z.string().email('Invalid email address').optional(),
  'type': z.string().min(1, 'type is required'),
});

export type CreateVisitRequest = z.infer<typeof CreateVisitRequestSchema>;

// ── SMS Send Request Schema ──
export const SmsSendRequestSchema = z.object({
  'visit-id': z.string().min(1, 'visit-id is required'),
});

export type SmsSendRequest = z.infer<typeof SmsSendRequestSchema>;

// ── API Response Types ──
export interface SendMailSuccessResponse {
  success: true;
  messageId: string;
}

export interface SendMailErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ── API Key Types ──
export interface ApiKeyPayload {
  key: string;
  tenant_id: string;
  created_at: number;
  expires_at: number; // 30 days from creation
  refreshable_until: number; // 1 year from creation
}

// ── Environment Bindings ──
export interface Env {
  KEYS_STORE: KVNamespace;
  DB: D1Database;
  SMSAPI_TOKEN: string;
  SENDER_NAME: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
}

// ── Hono Variables (set by middleware) ──
export interface Variables {
  apiKey: string;
  tenantId: string;
}
