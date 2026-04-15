"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type SellSectionNavItem = {
  id: string
  label: string
  /** Shorter label for the compact (mobile) link row */
  shortLabel?: string
}

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
}

export const SELL_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  { id: "sell-section-title", label: "Title & brand", shortLabel: "Title" },
  { id: "sell-section-shape", label: "Category & fins", shortLabel: "Category" },
  { id: "sell-section-dimensions", label: "Dimensions", shortLabel: "Dims" },
  { id: "sell-section-price", label: "Price", shortLabel: "Price" },
  { id: "sell-section-delivery", label: "Pickup & shipping", shortLabel: "Delivery" },
  { id: "sell-section-description", label: "Description", shortLabel: "Desc" },
  { id: "sell-section-photos", label: "Photos", shortLabel: "Photos" },
  { id: "sell-section-publish", label: "Publish", shortLabel: "Publish" },
]

/**
 * Tablet (md–lg): horizontal stepper (circles, checkmarks, connector); hidden on small phones
 * and replaced by the vertical rail at lg+.
 */
export function SellSectionNavHorizontal({
  items,
  sectionCompletion,
  className,
}: {
  items: readonly SellSectionNavItem[]
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn(
        "rounded-lg border border-border bg-card/80 py-3 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        <ol className="mx-auto flex w-max min-w-full items-start justify-center gap-0 px-3 pb-0.5 pt-0.5 sm:px-4">
          {items.map((item, index) => {
            const complete = sectionCompletion?.[item.id] === true
            const label = item.shortLabel ?? item.label
            return (
              <li key={item.id} className="flex items-start">
                {index > 0 ? (
                  <div
                    className="mt-2.5 h-px w-2 shrink-0 bg-foreground/25 sm:w-3"
                    aria-hidden
                  />
                ) : null}
                <div className="flex w-[3rem] shrink-0 flex-col items-center px-0.5 sm:w-14">
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground transition-opacity hover:opacity-90"
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3 w-3 text-background"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="w-full text-center text-[10px] leading-tight text-foreground sm:text-xs">
                      {label}
                    </span>
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}

/**
 * Desktop sidebar: dots on a vertical rail with section labels; completed steps show a checkmark.
 */
export function SellSectionNav({
  items,
  sectionCompletion,
  className,
}: {
  items: readonly SellSectionNavItem[]
  /** When set, keys are section ids (see `SELL_FORM_SECTION_NAV_ITEMS`); completed steps render a check. */
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn("sticky top-24", className)}
    >
      <div className="w-full overflow-auto">
        <div className="relative py-2">
          <div
            className="absolute left-[10px] top-2.5 bottom-2.5 w-px -translate-x-1/2 bg-foreground/25"
            aria-hidden
          />
          <ul className="relative m-0 list-none space-y-5 p-0">
            {items.map((item) => {
              const complete = sectionCompletion?.[item.id] === true
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "group flex w-full items-start gap-2.5 rounded-sm text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground transition-opacity group-hover:opacity-90"
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3 w-3 text-background"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 max-w-[13rem] pt-0.5 text-sm leading-snug text-foreground group-hover:underline group-hover:underline-offset-4">
                      {item.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
