import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useCallback } from "react"
import { NODE_TITLE_MAP } from "@/lib/constants"

const STORAGE_KEY = "medilive-chat-credentials"

// Module-level storage for turnstile token — must be available synchronously
// inside the body() closure, which fires before React commits state updates.
let turnstileTokenSync: string | null = null

function getStoredJwt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storeJwt(jwt: string) {
  try {
    localStorage.setItem(STORAGE_KEY, jwt)
  } catch {
    // Storage unavailable
  }
}

function clearJwt() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable
  }
}

export function useChatWidget(apiEndpoint: string) {
  const [hasStarted, setHasStarted] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<string | null>(null)
  const [visitId, setVisitId] = useState<string | null>(null)
  const [turnstileToken, setTurnstileTokenState] = useState<string | null>(null)

  // Sync setter: updates both the module-level variable (for synchronous
  // read in body()) and React state (for UI reactivity).
  const setTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenSync = token
    setTurnstileTokenState(token)
  }, [])

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: apiEndpoint,
      headers: (): Record<string, string> => {
        const currentJwt = getStoredJwt()
        return currentJwt ? { Authorization: currentJwt } : {}
      },
      body: () => {
        const body: Record<string, unknown> = {
          jwt: getStoredJwt(),
          dify_workflow_id: import.meta.env.VITE_DIFY_WORKFLOW_ID,
        }
        if (turnstileTokenSync) {
          body.turnstileToken = turnstileTokenSync
        }
        return body
      },
    }),
    onData: (data) => {
      const d = data as Record<string, unknown>
      if (d?.type === "data-chat-credentials") {
        const jwtFromData = (d.data as { jwt?: string })?.jwt
        if (jwtFromData) {
          storeJwt(jwtFromData)
        }
      }
      if (d?.type === "data-node-status") {
        const rawTitle = (d.data as { title: string | null })?.title
        if (rawTitle) {
          const displayTitle = NODE_TITLE_MAP[rawTitle] ?? rawTitle
          setNodeStatus(displayTitle.toUpperCase())
        } else {
          setNodeStatus(null)
        }
      }
      if (d?.type === "data-visit-created") {
        const visitIdFromData = (d.data as { visitId?: string })?.visitId
        if (visitIdFromData) setVisitId(visitIdFromData)
      }
    },
  })

  const { messages, sendMessage, setMessages, stop } = chat

  const hasSentFirstMessage = messages.length > 0

  const startChat = (text: string) => {
    setHasStarted(true)
    sendMessage({ text })
  }

  const newChat = () => {
    stop()
    clearJwt()
    setNodeStatus(null)
    setVisitId(null)
    setMessages([])
    setHasStarted(false)
  }

  return {
    ...chat,
    hasStarted,
    hasSentFirstMessage,
    nodeStatus,
    visitId,
    turnstileToken,
    setTurnstileToken,
    startChat,
    newChat,
  }
}