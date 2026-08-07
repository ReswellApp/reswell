"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SellModeToggle } from "@/components/features/sell/sell-mode-toggle"

type SellBoardModeHeaderProps = {
  active: "quick" | "advanced"
  /** Title, breadcrumb, or other primary header content */
  leading: ReactNode
  /** Tagline below the title (quick list only) */
  description?: ReactNode
  /** Draft picker, exit, and other toolbar actions */
  actions?: ReactNode
  /** Fallback status on small screens (e.g. local-device autosave) */
  status?: ReactNode
  /** Flush draft before Quick → Advanced so the wizard restores every field. */
  onBeforeNavigateToAdvanced?: () => void | Promise<void>
  className?: string
}

/**
 * Shared surfboard sell header — keeps the Quick list / Advanced toggle pinned
 * to the same spot when switching between `/sell/quick` and the full wizard.
 */
export function SellBoardModeHeader({
  active,
  leading,
  description,
  actions,
  status,
  onBeforeNavigateToAdvanced,
  className,
}: SellBoardModeHeaderProps) {
  const hasToolbarExtras = Boolean(actions)

  return (
    <div className={cn("mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-10", className)}>
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-1.5">
            {leading}
            {description ? (
              <div className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {description}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div
              className={cn(
                "inline-flex items-center self-start rounded-full border border-border/60 bg-background p-1 shadow-sm sm:self-end",
                hasToolbarExtras && "gap-0.5",
              )}
            >
              <SellModeToggle
                active={active}
                variant="embedded"
                onBeforeNavigateToAdvanced={onBeforeNavigateToAdvanced}
              />
              {hasToolbarExtras ? (
                <>
                  <div
                    className="mx-0.5 hidden h-7 w-px shrink-0 bg-border/70 sm:block"
                    aria-hidden
                  />
                  <div className="flex items-center gap-0.5 pr-0.5">{actions}</div>
                </>
              ) : null}
            </div>
            {status ? (
              <p
                className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground sm:hidden"
                aria-live="polite"
              >
                {status}
              </p>
            ) : null}
          </div>
        </div>
      </header>
    </div>
  )
}
