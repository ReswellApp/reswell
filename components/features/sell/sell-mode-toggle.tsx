"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { SlidersHorizontal, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { logSellForkToFull } from "@/lib/sell-flow/log-sell-funnel-event"

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"

/**
 * Segmented switch between the two surfboard listing experiences:
 * Quick list (photo-first single screen) and Advanced (full step-by-step
 * wizard with shipping setup and drafts). Both publish the same listing.
 */
export function SellModeToggle({
  active,
  className,
  variant = "default",
  /** Flush IDB (etc.) before leaving Quick so Advanced restores every field. */
  onBeforeNavigateToAdvanced,
}: {
  active: "quick" | "advanced"
  className?: string
  /** `embedded` drops the outer shell — use inside {@link SellBoardModeHeader} toolbar. */
  variant?: "default" | "embedded"
  onBeforeNavigateToAdvanced?: () => void | Promise<void>
}) {
  const router = useRouter()

  return (
    <div
      role="group"
      aria-label="Listing form style"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5",
        variant === "default" && "border border-border/60 bg-muted/50",
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
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Zap className="size-3.5 shrink-0" aria-hidden />
        Quick list
      </Link>
      {active === "quick" && onBeforeNavigateToAdvanced ? (
        <button
          type="button"
          aria-current={undefined}
          className={cn(
            PILL_BASE,
            "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
          onClick={() => {
            void (async () => {
              try {
                await onBeforeNavigateToAdvanced()
              } catch {
                /* still navigate — Advanced can restore whatever was last flushed */
              }
              logSellForkToFull({ message: "mode_toggle" })
              router.push("/sell/boards")
            })()
          }}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          Advanced
        </button>
      ) : (
        <Link
          href="/sell/boards"
          aria-current={active === "advanced" ? "page" : undefined}
          onClick={() => {
            if (active === "quick") {
              logSellForkToFull({ message: "mode_toggle" })
            }
          }}
          className={cn(
            PILL_BASE,
            active === "advanced"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
          Advanced
        </Link>
      )}
    </div>
  )
}
