import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { cn } from "@/lib/utils"
import { Loader } from "@/components/ui/loader"
import { MESSAGE_LIST } from "@/lib/constants"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import type { UIMessage } from "ai"

interface MessageListProps {
  messages: UIMessage[]
  isStreaming: boolean
  botName: string
  botAvatarUrl?: string
  nodeStatus?: string | null
  visitId?: string | null
}

export function MessageList({
  messages,
  isStreaming,
  botName,
  botAvatarUrl,
  nodeStatus,
  visitId,
}: MessageListProps) {
  if (messages.length === 0) return null

  return (
    <div className={cn("flex flex-col gap-4 px-4 py-4")}>
      {messages.map((message, idx) => {
        const isUser = message.role === "user"
        const isLast = idx === messages.length - 1
        const hasText = message.parts?.some(
          (p) => p.type === "text" && (p as { text?: string }).text,
        )

        // Skip empty assistant bubble while streaming — the loader handles it
        if (!isUser && isLast && isStreaming && !hasText) return null

        return (
          <Message
            key={message.id}
            className={cn(isUser && "flex-row-reverse")}
          >
            <MessageAvatar
              src={isUser ? "" : botAvatarUrl ?? ""}
              alt={isUser ? "You" : botName}
              fallback={isUser ? MESSAGE_LIST.userAvatarFallback : botName.charAt(0).toUpperCase()}
            />
            <MessageContent markdown={!isUser}>
              {message.parts
                .filter((part) => part.type === "text")
                .map((part) => (part as { text: string }).text)
                .join("")}
            </MessageContent>
          </Message>
        )
      })}

      {isStreaming &&
        (() => {
          const lastMsg = messages[messages.length - 1]
          const lastHasText =
            lastMsg &&
            lastMsg.role !== "user" &&
            lastMsg.parts?.some(
              (p) => p.type === "text" && (p as { text?: string }).text,
            )
          return !lastHasText
        })() && (
        <Message>
          <MessageAvatar
            src={botAvatarUrl ?? ""}
            alt={botName}
            fallback={botName.charAt(0).toUpperCase()}
          />
           <div className="flex items-center px-2 py-2">
             {nodeStatus ? (
               <span className="text-muted-foreground animate-pulse text-sm">
                 {nodeStatus}
               </span>
             ) : (
               <Loader variant="typing" size="sm" />
             )}
           </div>
        </Message>
      )}

      {visitId && !isStreaming && (
        <Link
          to={`/wizyty/${visitId}`}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3",
            "hover:bg-primary/10 transition-colors cursor-pointer",
            "no-underline",
            "animate-visit-card",
          )}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <ArrowRight className="size-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">
            Kliknij, aby umówić wizytę
          </span>
        </Link>
      )}
    </div>
  )
}
