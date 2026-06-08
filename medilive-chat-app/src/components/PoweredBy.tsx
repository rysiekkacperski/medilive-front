import { POWERED_BY } from "@/lib/constants"

interface PoweredByProps {
  /** URL for the logo image to display next to "POWERED BY" */
  logoSrc?: string
  /** Alt text for the logo image */
  logoAlt?: string
}

export function PoweredBy({ logoSrc, logoAlt }: PoweredByProps) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 pb-2 pt-0.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-widest leading-none">
        {POWERED_BY.label}
      </span>
      {logoSrc && (
        <img src={logoSrc} alt={logoAlt ?? ""} className="h-3 w-auto" />
      )}
    </div>
  )
}