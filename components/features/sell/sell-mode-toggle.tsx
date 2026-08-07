import Link from "next/link"
import { SlidersHorizontal, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * Segmented switch between the two surfboard listing experiences:
 * Quick list (photo-first single screen) and Advanced (full step-by-step
 * wizard with shipping setup and drafts). Both publish the same listing.
 */
export function SellModeToggle({
  active,
  className,
}: {
  active: "quick" | "advanced"
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Listing form style"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5",
        className,
      )}
    >
      <Link
        href="/sell/quick"
        aria-current={active === "quick" ? "page" : undefined}
        className={cn(
          PILL_BASE,
          active === "quick"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Zap className="size-3.5" aria-hidden />
        Quick list
      </Link>
      <Link
        href="/sell?type=surfboard"
        aria-current={active === "advanced" ? "page" : undefined}
        className={cn(
          PILL_BASE,
          active === "advanced"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="size-3.5" aria-hidden />
        Advanced
      </Link>
    </div>
  )
}
