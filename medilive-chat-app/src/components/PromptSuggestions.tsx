import { PromptSuggestion } from "@/components/ui/prompt-suggestion"
import { cn } from "@/lib/utils"

interface PromptSuggestionsProps {
  suggestions: string[]
  onSelect: (text: string) => void
}

export function PromptSuggestions({
  suggestions,
  onSelect,
}: PromptSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div
      className={cn(
        "flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto",
        "px-4 pb-3 pt-1 scrollbar-none"
      )}
    >
      {suggestions.map((suggestion) => (
        <PromptSuggestion
          key={suggestion}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </PromptSuggestion>
      ))}
    </div>
  )
}