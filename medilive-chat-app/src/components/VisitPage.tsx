import { useParams, Link } from "react-router-dom"
import { CircleCheck } from "lucide-react"

export function VisitPage() {
  const { visitId } = useParams<{ visitId: string }>()
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background p-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CircleCheck className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Wizyta została zarejestrowana
        </h2>
        <p className="text-sm text-muted-foreground">
          Wizyta o identyfikatorze{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {visitId}
          </code>{" "}
          została zarejestrowana.
        </p>
        <Link
          to="/"
          className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Wróć do czatu
        </Link>
      </div>
    </div>
  )
}