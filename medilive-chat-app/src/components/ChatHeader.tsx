import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CHAT_HEADER } from "@/lib/constants"
import { RotateCcw } from "lucide-react"

interface ChatHeaderProps {
  avatarUrl?: string
  botName: string
  onNewChat: () => void
}

export function ChatHeader({ avatarUrl, botName, onNewChat }: ChatHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between",
        "border-border border-b px-4 py-3"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="bg-primary/20 flex h-9 w-9 items-center justify-center rounded-full">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={botName}
              className="h-9 w-9 rounded-full"
            />
          ) : (
            <span className="text-primary text-sm font-semibold">
              {botName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span className="text-foreground text-sm font-semibold">{botName}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onNewChat}
        aria-label={CHAT_HEADER.newChatAriaLabel}
      >
        <RotateCcw className="size-4" />
      </Button>
    </header>
  )
}
