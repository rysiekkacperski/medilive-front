import { createParser, type EventSourceMessage, type ParseError } from "eventsource-parser";
import { createJwt } from "../jwt";
import { uuidv4 } from "../lib/uuid";
import { createSseHelpers } from "./sse-helpers";
import type { DifyStreamEvent } from "../types";

// Pipes Dify's SSE stream through eventsource-parser, mapping each Dify event
// to a Vercel AI SDK v6 data stream event written into the given writer.
export async function streamDifyToClient(
  difyResponse: Response,
  serverSecret: string,
  conversationId: string | undefined,
  userId: string,
  writable: WritableStream<Uint8Array>,
) {
  const writer = writable.getWriter();
  const messageId = uuidv4();
  const textId = uuidv4();

  const {
    sendMessageStart,
    sendTextStart,
    sendTextDelta,
    sendTextEnd,
    sendCredentials,
    sendError,
    sendFinish,
    sse,
  } = createSseHelpers(writer, messageId, textId);

  // Runs fully async behind the returned Response — fills the pipe
  (async () => {
    let hasSentCredentials = false;

    await sendMessageStart();
    await sendTextStart();

    // On the very first message token of a brand-new conversation,
    // mint a JWT with the Dify conversation_id + user_id and send it
    // as a custom data part so the client can reuse it on subsequent messages.
    const parser = createParser({
      onError(error: ParseError) {
        console.error("eventsource-parser error:", error);
      },

      onEvent(event: EventSourceMessage) {
        try {
          const data = JSON.parse(event.data) as DifyStreamEvent;

          if (data.event === "message") {
            // First-token JWT handoff — only for new conversations
            if (!conversationId && !hasSentCredentials && data.conversation_id) {
              createJwt(
                { conversation_id: data.conversation_id, user_id: userId },
                serverSecret,
                86400,
              ).then((token) => {
                sendCredentials({
                  type: "chat-credentials",
                  jwt: token,
                  user_id: userId,
                });
              });
              hasSentCredentials = true;
            }

            sendTextDelta(data.answer);
          } else if (
            data.event === "node_started" ||
            data.event === "workflow_started"
          ) {
            const title = data.data?.title as string | undefined;
            if (title) {
              sse({ type: "data-node-status", data: { title } });
            }
          } else if (data.event === "node_finished") {
            const title = data.data?.title as string | undefined;
            sse({ type: "data-node-status", data: { title: null } });

            // When the CREATE_VISIT node finishes, forward the visit ID
            if (title === "CREATE_VISIT") {
              const outputs = data.data?.outputs as {
                body?: string;
              } | undefined;
              if (outputs?.body) {
                try {
                  const parsed = JSON.parse(outputs.body) as {
                    visit?: { id?: string };
                  };
                  const visitId = parsed?.visit?.id;
                  if (visitId) {
                    sse({ type: "data-visit-created", data: { visitId } });
                  }
                } catch {
                  console.error(
                    "Failed to parse CREATE_VISIT outputs.body",
                  );
                }
              }
            }
          } else if (data.event === "workflow_finished") {
            sse({ type: "data-node-status", data: { title: null } });
          } else if (data.event === "error") {
            sendError(data.message ?? "Stream Error");
          }
        } catch (err) {
          console.error("Failed to parse inner Dify event JSON", err);
        }
      },
    });

    const reader = difyResponse.body?.getReader();
    if (!reader) {
      await sendError("Failed to initialize stream reader");
      await writer.close();
      return;
    }

    const decoder = new TextDecoder("utf-8");
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          parser.reset({ consume: true });
          break;
        }
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (streamError) {
      console.error("Stream reading interrupted:", streamError);
    } finally {
      reader.releaseLock();
      await sendTextEnd();
      await sendFinish();
      await writer.close();
    }
  })().catch((err) => {
    console.error("Stream error (client disconnected):", err);
  });
}