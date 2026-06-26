import type { ChatCredentialsData } from "../types";

// Each helper writes one SSE event in the Vercel AI SDK v6 data stream format.
// Protocol: `data: <JSON>\n\n` per event, terminated by `data: [DONE]\n\n`.
// All helpers close over the same writer + encoder so we don't pass them around.

export function createSseHelpers(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  messageId: string,
  textId: string,
) {
  const encoder = new TextEncoder();

  // Raw SSE write — used internally and exposed for one-off custom events
  const sse = (payload: object): Promise<void> =>
    writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  return {
    // Exposed for custom ad-hoc events (node-status, visit-created, etc.)
    sse,

    sendMessageStart() {
      return sse({ type: "start", messageId });
    },

    // Text block lifecycle — one block per assistant response
    sendTextStart() {
      return sse({ type: "text-start", id: textId });
    },
    sendTextDelta(delta: string) {
      return sse({ type: "text-delta", id: textId, delta });
    },
    sendTextEnd() {
      return sse({ type: "text-end", id: textId });
    },

    // Custom data parts — readable on the client via message.parts
    sendCredentials(data: ChatCredentialsData) {
      return sse({ type: "data-chat-credentials", data });
    },

    sendError(errorText: string) {
      return sse({ type: "error", errorText });
    },

    // Closes the message, then the stream
    async sendFinish() {
      await sse({ type: "finish-step" });
      await sse({ type: "finish" });
      // SSE termination marker — clients use this to know the stream is done
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    },
  };
}