"use client"

import { useState } from "react"

import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container"
import { cn } from "@/lib/utils"
import {
  CHAT_WIDGET,
  DEFAULT_SUGGESTIONS,
  ERROR_MESSAGE,
} from "@/lib/constants"
import { useChatWidget } from "@/hooks/useChatWidget"
import { ChatHeader } from "@/components/ChatHeader"
import { WelcomeScreen } from "@/components/WelcomeScreen"
import { MessageList } from "@/components/MessageList"
import { PromptSuggestions } from "@/components/PromptSuggestions"
import { ChatInput } from "@/components/ChatInput"
import { PoweredBy } from "@/components/PoweredBy"

interface ChatWidgetProps {
  apiEndpoint: string
  botName?: string
  botAvatarUrl?: string
  suggestions?: string[]
  poweredByLogoSrc?: string
  poweredByLogoAlt?: string
}

export function ChatWidget({
  apiEndpoint,
  botName = CHAT_WIDGET.defaultBotName,
  botAvatarUrl,
  suggestions = DEFAULT_SUGGESTIONS,
  poweredByLogoSrc,
  poweredByLogoAlt,
}: ChatWidgetProps) {
  const [input, setInput] = useState("")

  const {
    messages,
    status,
    hasStarted,
    hasSentFirstMessage,
    nodeStatus,
    visitId,
    startChat,
    newChat,
    stop,
    error,
    regenerate,
  } = useChatWidget(apiEndpoint)

  const isStreaming = status === "submitted" || status === "streaming"

  const handleSubmit = () => {
    if (!input.trim()) return
    startChat(input.trim())
    setInput("")
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    startChat(suggestion)
    setInput("")
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        "rounded-2xl border border-border bg-background shadow-lg"
      )}
    >
      <ChatHeader botName={botName} avatarUrl={botAvatarUrl} onNewChat={newChat} />

      {!hasSentFirstMessage ? (
        <WelcomeScreen botName={botName} avatarUrl={botAvatarUrl} />
      ) : (
        <ChatContainerRoot className="min-h-0 flex-1">
          <ChatContainerContent>
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              nodeStatus={nodeStatus}
              visitId={visitId}
            />

            {error && (
              <div className="flex items-center justify-center gap-2 px-4 py-2">
                <span className="text-destructive text-xs">
                  {ERROR_MESSAGE.generic}
                </span>
                <button
                  type="button"
                  className="text-primary text-xs underline"
                  onClick={() => regenerate()}
                >
                  {ERROR_MESSAGE.retry}
                </button>
              </div>
            )}

            <ChatContainerScrollAnchor />
          </ChatContainerContent>
        </ChatContainerRoot>
      )}

      {!hasStarted && !hasSentFirstMessage && (
        <PromptSuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionClick}
        />
      )}

      <ChatInput
        value={input}
        onValueChange={setInput}
        onSubmit={handleSubmit}
        onStop={stop}
        isStreaming={isStreaming}
        placeholder={
          isStreaming
            ? CHAT_WIDGET.inputStreamingPlaceholder
            : CHAT_WIDGET.inputPlaceholder
        }
      />

      <PoweredBy logoSrc={poweredByLogoSrc} logoAlt={poweredByLogoAlt} />
    </div>
  )
}
