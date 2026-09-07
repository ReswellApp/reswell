import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Minimal city strip header — type-led, no panels, badges, or motion chrome.
 */
export function CityLandingStripSection({
  title,
  label,
  showDivider = false,
  emphasis = false,
  children,
}: {
  title: string
  label: string
  /** Hairline between strips (not on the first). */
  showDivider?: boolean
  /** Slightly larger title for the primary listings row. */
  emphasis?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "mb-9 sm:mb-10",
        showDivider && "border-t border-border/60 pt-9 sm:pt-10",
      )}
    >
      <h2
        className={cn(
          "mb-4 font-headline font-semibold tracking-tight text-foreground sm:mb-5",
          emphasis ? "text-xl sm:text-[1.625rem]" : "text-lg sm:text-xl",
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}
