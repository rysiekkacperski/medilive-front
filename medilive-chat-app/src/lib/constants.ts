// ============================================================================
// Chat Widget Text Content
// All user-facing strings are centralized here for easy editing.
// ============================================================================

export const CHAT_WIDGET = {
  /** Default bot name when none is provided */
  defaultBotName: "Inteligentny asystent kliniki NovaMed",

  /** Placeholder for the text input when idle */
  inputPlaceholder: "Wpisz swoją wiadomość...",

  /** Placeholder for the text input while streaming */
  inputStreamingPlaceholder: "Generowanie odpowiedzi...",
} as const

export const CHAT_HEADER = {
  /** aria-label for the "new chat" button */
  newChatAriaLabel: "Zacznij nową rozmowę",
} as const

export const WELCOME_SCREEN = {
  /** Subtitle text shown on the welcome screen */
  subtitle: "Cześć! Jestem tu, aby pomóc. Zadaj mi dowolne pytanie lub wybierz sugestię poniżej.",
} as const

export const MESSAGE_LIST = {
  /** Fallback letter shown in user avatar when no image is provided */
  userAvatarFallback: "U",
} as const

export const CHAT_INPUT = {
  /** Tooltip text for the send button */
  sendTooltip: "Wyślij wiadomość",

  /** Tooltip text for the stop button */
  stopTooltip: "Zatrzymaj",
} as const

export const ERROR_MESSAGE = {
  /** Generic error message displayed to the user */
  generic: "Coś poszło nie tak.",

  /** Label for the retry button */
  retry: "Ponów",
} as const

export const POWERED_BY = {
  /** Label text before the logo */
  label: "POWERED BY",
} as const

/**
 * Maps raw Dify node titles to user-facing Polish labels.
 * If a node title is not in this map, the raw title is shown as-is (uppercased).
 */
export const NODE_TITLE_MAP: Record<string, string> = {
  CREATE_VISIT: "Tworzę wizytę",
}

export const DEFAULT_SUGGESTIONS: string[] = [
  "Jakie usługi oferujecie?",
  "Jakie są godziny otwarcia kliniki?",
  "Powiedz mi więcej o NovaMed",
]
