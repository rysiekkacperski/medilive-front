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
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  content: EmailContentSchema,
  // Optional: specify a custom sender name override
  senderName: z.string().optional(),
});

export type SendMailRequest = z.infer<typeof SendMailRequestSchema>;

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

// ── Error codes returned by the Email binding ──
export type EmailErrorCode =
  | 'E_VALIDATION_ERROR'
  | 'E_FIELD_MISSING'
  | 'E_TOO_MANY_RECIPIENTS'
  | 'E_SENDER_NOT_VERIFIED'
  | 'E_RECIPIENT_NOT_ALLOWED'
  | 'E_RECIPIENT_SUPPRESSED'
  | 'E_SENDER_DOMAIN_NOT_AVAILABLE'
  | 'E_CONTENT_TOO_LARGE'
  | 'E_RATE_LIMIT_EXCEEDED'
  | 'E_DAILY_LIMIT_EXCEEDED'
  | 'E_DELIVERY_FAILED'
  | 'E_INTERNAL_SERVER_ERROR'
  | 'E_HEADER_NOT_ALLOWED'
  | 'E_HEADER_USE_API_FIELD'
  | 'E_HEADER_VALUE_INVALID'
  | 'E_HEADER_VALUE_TOO_LONG'
  | 'E_HEADER_NAME_INVALID'
  | 'E_HEADERS_TOO_LARGE'
  | 'E_HEADERS_TOO_MANY';

// ── API Key Types ──
export interface ApiKeyPayload {
  key: string;
  created_at: number;
  expires_at: number; // 30 days from creation
  refreshable_until: number; // 1 year from creation
}

// ── Environment Bindings ──
export interface Env {
  EMAIL: {
    send(message: EmailMessage): Promise<{ messageId: string }>;
  };
  KEYS_STORE: KVNamespace;
  SENDER_EMAIL: string;
  SENDER_NAME: string;
}

// The EmailMessage type matches the CF Email Workers binding
interface EmailMessage {
  to: string | string[];
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    content: string | ArrayBuffer | ArrayBufferView;
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
    contentId?: string;
  }>;
  headers?: Record<string, string>;
}

// ── Hono Variables (set by middleware) ──
export interface Variables {
  apiKey: string;
}