import { POWERED_BY } from "@/lib/constants"

interface PoweredByProps {
  logoSrc?: string
  logoAlt?: string
}

export function PoweredBy({ logoSrc, logoAlt }: PoweredByProps) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 pb-2 pt-2">
      <span className="text-muted-foreground text-[10px] font-medium tracking-widest leading-none">
        {POWERED_BY.label}
      </span>
      {logoSrc && (
        <img src={logoSrc} alt={logoAlt ?? ""} className="h-3 w-auto" />
      )}
    </div>
  )
}