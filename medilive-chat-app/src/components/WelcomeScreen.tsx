import { cn } from "@/lib/utils"
import { WELCOME_SCREEN } from "@/lib/constants"

interface WelcomeScreenProps {
  botName: string
  avatarUrl?: string
  turnstileSlot?: React.ReactNode
}

export function WelcomeScreen({ botName, avatarUrl, turnstileSlot }: WelcomeScreenProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center",
        "px-6 text-center"
      )}
    >
      <div className="bg-primary/20 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={botName}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <span className="text-primary text-2xl font-bold">
            {botName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <h2 className="text-foreground mb-2 text-lg font-semibold">
        {botName}
      </h2>

      <p className="text-muted-foreground mb-6 max-w-xs text-sm">
        {WELCOME_SCREEN.subtitle}
      </p>

      {turnstileSlot}
    </div>
  )
}
