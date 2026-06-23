import { Routes, Route } from "react-router-dom"
import { ChatWidget } from "@/components/ChatWidget"
import { VisitPage } from "@/components/VisitPage"
import avatarSrc from "@/assets/avatar.jpg"
import mediLiveLogoSrc from "@/assets/medilive-logo.svg"

function ChatPage() {
  return (
    <div className="h-dvh w-full">
      <ChatWidget
        apiEndpoint={`${import.meta.env.VITE_WORKER_API_URL}/send-message`}
        botName="Asystent kliniki NovaMed"
        botAvatarUrl={avatarSrc}
        poweredByLogoSrc={mediLiveLogoSrc}
        poweredByLogoAlt="MediLive"
      />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/wizyty/:visitId" element={<VisitPage />} />
    </Routes>
  )
}

export default App
