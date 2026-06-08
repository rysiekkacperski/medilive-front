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