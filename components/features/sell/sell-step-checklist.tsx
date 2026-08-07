"use client"

import { ArrowRight, CheckCircle2, Circle } from "lucide-react"

import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import type { SellStepChecklistItem } from "@/lib/sell-section-completion"
import { cn } from "@/lib/utils"

export interface SellStepChecklistProps {
  /** Requirements to show (current step, or all remaining on the publish step). */
  items: SellStepChecklistItem[]
  /** Section the wizard is currently on — items from other sections get a jump link. */
  activeSectionId: string
  /** Labels for jump links, keyed by section id. */
  sectionLabelById: Record<string, string>
  onGoToSection?: (sectionId: string) => void
  title?: string
  className?: string
}

/**
 * Inline requirement checklist rendered above the wizard footer so the seller
 * always knows exactly what's left — publish can never fail for a reason that
 * wasn't already visible. Collapses away entirely once everything is done.
 */
export function SellStepChecklist({
  items,
  activeSectionId,
  sectionLabelById,
  onGoToSection,
  title = "Still needed",
  className,
}: SellStepChecklistProps) {
  const incomplete = items.filter((item) => !item.complete)
  const open = incomplete.length > 0

  return (
    <SmoothCollapse open={open} className={className}>
      <div
        className="rounded-lg border border-border bg-muted/60 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => {
            const offStep = item.sectionId !== activeSectionId
            return (
              <li key={`${item.sectionId}:${item.id}`} className="flex items-center gap-2 text-sm">
                {item.complete ? (
                  <CheckCircle2 className="size-4 shrink-0 text-listingHeart" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span
                  className={cn(
                    item.complete
                      ? "text-muted-foreground line-through decoration-muted-foreground/40"
                      : "text-foreground",
                  )}
                >
                  {item.label}
                </span>
                {!item.complete && offStep && onGoToSection ? (
                  <button
                    type="button"
                    onClick={() => onGoToSection(item.sectionId)}
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-listingHeart transition-colors hover:bg-listingHeart/10"
                  >
                    {sectionLabelById[item.sectionId] ?? "Go"}
                    <ArrowRight className="size-3" aria-hidden />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </SmoothCollapse>
  )
}
