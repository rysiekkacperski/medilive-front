import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState } from "react"

const STORAGE_KEY = "medilive-chat-credentials"

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
  const [jwt, setJwt] = useState<string | null>(getStoredJwt)
  const [hasStarted, setHasStarted] = useState(false)
  const [nodeStatus, setNodeStatus] = useState<string | null>(null)

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: apiEndpoint,
      headers: (): Record<string, string> => {
        const currentJwt = getStoredJwt()
        return currentJwt ? { Authorization: currentJwt } : {}
      },
      body: () => ({
        jwt: jwt,
        dify_workflow_id: import.meta.env.VITE_DIFY_WORKFLOW_ID,
      }),
    }),
    onData: (data) => {
      const d = data as Record<string, unknown>
      if (d?.type === "chat-credentials" && typeof d.jwt === "string") {
        setJwt(d.jwt)
        storeJwt(d.jwt)
      }
      if (d?.type === "data-node-status") {
        setNodeStatus((d.data as { title: string | null })?.title ?? null)
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
    setJwt(null)
    setNodeStatus(null)
    setMessages([])
    setHasStarted(false)
  }

  return {
    ...chat,
    hasStarted,
    hasSentFirstMessage,
    nodeStatus,
    startChat,
    newChat,
  }
}