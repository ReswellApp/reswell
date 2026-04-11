"use client"

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
  { id: "sell-section-delivery", label: "Pickup & shipping", shortLabel: "Delivery" },
  { id: "sell-section-price", label: "Price & condition", shortLabel: "Price" },
  { id: "sell-section-description", label: "Description", shortLabel: "Desc" },
  { id: "sell-section-photos", label: "Photos", shortLabel: "Photos" },
  { id: "sell-section-publish", label: "Publish", shortLabel: "Publish" },
]

/**
 * Vertical stepper matching the sell flow: hollow nodes, thick rail, labels on the right.
 */
export function SellSectionNav({
  items,
  className,
}: {
  items: readonly SellSectionNavItem[]
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn("sticky top-24", className)}
    >
      <div className="relative">
        <div
          className="absolute left-2 top-2 bottom-2 w-[3px] -translate-x-1/2 rounded-full bg-foreground"
          aria-hidden
        />
        <ul className="relative space-y-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToSection(item.id)}
                className={cn(
                  "group flex w-full gap-3 text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
                )}
              >
                <span
                  className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"
                  aria-hidden
                >
                  <span
                    className={cn(
                      "h-3.5 w-3.5 rounded-full border-[2.5px] border-foreground bg-muted ring-2 ring-muted",
                      "transition-transform group-hover:scale-110",
                    )}
                  />
                </span>
                <span className="max-w-[11rem] text-sm leading-snug text-foreground group-hover:underline group-hover:underline-offset-4">
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

/** Compact text links for small screens — same targets as the stepper. */
export function SellSectionNavCompact({
  items,
  className,
}: {
  items: readonly SellSectionNavItem[]
  className?: string
}) {
  return (
    <nav
      aria-label="Jump to form section"
      className={cn(
        "rounded-lg border border-border bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex flex-wrap gap-x-1 gap-y-1 text-xs leading-relaxed">
        {items.map((item, i) => (
          <span key={item.id} className="inline-flex items-center">
            {i > 0 ? (
              <span className="mx-1 text-muted-foreground select-none" aria-hidden>
                ·
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {item.shortLabel ?? item.label}
            </button>
          </span>
        ))}
      </div>
    </nav>
  )
}
