import { z } from 'zod';

// 1. Dify Request Payload Types
export interface DifyPayload {
  inputs: Record<string, unknown>;
  query: string;
  response_mode: 'streaming' | 'blocking';
  user: string;
  conversation_id?: string;
  app_id?: string;
}

// 2. Vercel AI SDK Custom Data Types (sendData)

export interface ChatCredentialsData {
  type: 'chat-credentials';
  jwt: string;
  user_id: string;
}

export interface VisitCreatedData {
  type: 'visit-created';
  visitId: string;
}

// 3. Inner Dify Stream Event Types (Parsed from event.data)

interface DifyEventBase {
  task_id?: string;
  workflow_run_id?: string;
  message_id?: string;
  conversation_id?: string;
  created_at: number;
}

export interface DifyMessageEvent extends DifyEventBase {
  event: 'message';
  answer: string;
}

export interface DifyMessageEndEvent extends DifyEventBase {
  event: 'message_end';
  id: string;
  metadata: {
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      total_price: string;
      currency: string;
      [key: string]: unknown;
    };
    retriever_resources?: Array<Record<string, unknown>>;
  };
}

export interface DifyWorkflowEvent extends DifyEventBase {
  event: 'workflow_started' | 'workflow_finished' | 'node_started' | 'node_finished';
  data: Record<string, unknown>;
}

export interface DifyTTSEvent extends DifyEventBase {
  event: 'tts_message' | 'tts_message_end';
  audio: string;
}

export interface DifyErrorEvent {
  event: 'error';
  message?: string;
  status?: number;
  code?: string;
}

export type DifyStreamEvent =
  | DifyMessageEvent
  | DifyMessageEndEvent
  | DifyWorkflowEvent
  | DifyTTSEvent
  | DifyErrorEvent;

// 4. Network / Endpoint Error Types

export interface DifyEndpointError {
  error: string;
  status?: number;
  details?: unknown;
}

// 5. Hono environment bindings

export interface Env {
  SERVER_SECRET: string;
  DIFY_API_KEY: string;
  DIFY_API_URL: string;
  KEYS_STORE: KVNamespace;
  TURNSTILE_SECRET_KEY?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

// 6. Request validation schemas

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string().optional(),
  parts: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .optional(),
});

export const SendMessageRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  jwt: z.string().nullable().optional(),
  dify_workflow_id: z.string().min(1, 'Missing workflow identifier'),
  turnstileToken: z.string().nullable().optional(),
});
