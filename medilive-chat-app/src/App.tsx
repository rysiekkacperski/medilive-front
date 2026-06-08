import { ChatWidget } from "@/components/ChatWidget"
import avatarSrc from "@/assets/avatar.jpg"
import mediLiveLogoSrc from "@/assets/medilive-logo.svg"

function App() {
  return (
    <div className="h-dvh w-full">
      <ChatWidget
        apiEndpoint={import.meta.env.VITE_WORKER_API_URL ?? "/api/chat"}
        botName="Asystent kliniki NovaMed"
        botAvatarUrl={avatarSrc}
        poweredByLogoSrc={mediLiveLogoSrc}
        poweredByLogoAlt="MediLive"
      />
    </div>
  )
}

export default App