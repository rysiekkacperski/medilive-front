import {
  PromptInput,
  PromptInputActions,
  PromptInputAction,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { CHAT_INPUT } from "@/lib/constants"
import { ArrowUp, Square } from "lucide-react"

interface ChatInputProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onValueChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit()
    }
  }

  const inputDisabled = disabled || isStreaming

  return (
    <div className="shrink-0 px-3 py-2">
      <PromptInput
        value={value}
        onValueChange={onValueChange}
        onSubmit={handleSubmit}
        disabled={inputDisabled}
        className="p-1.5 rounded-xl"
      >
        <PromptInputTextarea
          placeholder={placeholder}
          className="min-h-[24px] text-sm leading-5 py-[2px]"
        />

        <PromptInputActions className="justify-end">
          {isStreaming ? (
            <PromptInputAction tooltip={CHAT_INPUT.stopTooltip}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onStop}
                aria-label={CHAT_INPUT.stopTooltip}
              >
                <Square className="size-3 fill-current" />
              </Button>
            </PromptInputAction>
          ) : (
            <PromptInputAction tooltip={CHAT_INPUT.sendTooltip}>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="size-7"
                onClick={handleSubmit}
                disabled={inputDisabled || !value.trim()}
                aria-label={CHAT_INPUT.sendTooltip}
              >
                <ArrowUp className="size-4" />
              </Button>
            </PromptInputAction>
          )}
        </PromptInputActions>
      </PromptInput>
    </div>
  )
}