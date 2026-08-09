"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SellBoardModeHeaderProps = {
  /** Title, breadcrumb, or other primary header content */
  leading: ReactNode
  /** Optional supporting line under the title */
  description?: ReactNode
  /** Draft picker, exit, and other toolbar actions */
  actions?: ReactNode
  /** Fallback status on small screens (e.g. local-device autosave) */
  status?: ReactNode
  className?: string
}

/**
 * Surfboard sell header for the full listing wizard.
 * (Quick list / Advanced mode toggle is retired — one create flow.)
 */
export function SellBoardModeHeader({
  leading,
  description,
  actions,
  status,
  className,
}: SellBoardModeHeaderProps) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 pt-5 sm:pt-12 lg:max-w-none lg:px-0", className)}>
      <header className="mb-5 sm:mb-10">
        <div className="flex flex-row items-start justify-between gap-3 sm:gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            {leading}
            {description ? (
              <div className="hidden text-base leading-relaxed text-muted-foreground sm:block">
                {description}
              </div>
            ) : null}
          </div>

          {actions || status ? (
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {actions ? (
                <div className="inline-flex items-center self-start rounded-full border border-border/60 bg-background p-1 shadow-sm sm:self-end">
                  <div className="flex items-center gap-0.5 px-0.5">{actions}</div>
                </div>
              ) : null}
              {status ? (
                <p
                  className="flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground sm:hidden"
                  aria-live="polite"
                >
                  {status}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
    </div>
  )
}
