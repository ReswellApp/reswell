"use client"

import type { ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface QuickEssentialCardProps {
  title: string
  /** Quiet one-liner under the title. */
  hint?: string
  /** Shows a small brand-colored check when the essential is filled in. */
  complete?: boolean
  children: ReactNode
  className?: string
}

/**
 * One of the six Quick List essentials — a light card, not a heavy form
 * section: minimal label, generous padding, a quiet check when done.
 */
export function QuickEssentialCard({
  title,
  hint,
  complete = false,
  children,
  className,
}: QuickEssentialCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-white p-5 shadow-surface sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {hint ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {hint}
            </p>
          ) : null}
        </div>
        {complete ? (
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-listingHeart"
            aria-label="Done"
          />
        ) : null}
      </div>
      {children}
    </section>
  )
}
