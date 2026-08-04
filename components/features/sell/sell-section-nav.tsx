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

function selectSection(
  id: string,
  onSelectSection?: (id: string) => void,
) {
  if (onSelectSection) {
    onSelectSection(id)
    return
  }
  scrollToSection(id)
}

export const SELL_FINS_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  {
    id: "sell-fins-section-photos-title",
    label: "Photos & title",
    shortLabel: "Start",
  },
  {
    id: "sell-fins-section-details",
    label: "Fin details",
    shortLabel: "Details",
  },
  { id: "sell-fins-section-delivery", label: "Shipping", shortLabel: "Shipping" },
  {
    id: "sell-fins-section-publish",
    label: "Price & publish",
    shortLabel: "Publish",
  },
]

export const SELL_WETSUITS_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  {
    id: "sell-wetsuits-section-photos-title",
    label: "Photos & title",
    shortLabel: "Start",
  },
  {
    id: "sell-wetsuits-section-details",
    label: "Wetsuit details",
    shortLabel: "Details",
  },
  { id: "sell-wetsuits-section-delivery", label: "Shipping", shortLabel: "Shipping" },
  {
    id: "sell-wetsuits-section-publish",
    label: "Price & publish",
    shortLabel: "Publish",
  },
]

/**
 * Section nav items for an accessory-type sell flow (wetsuits, boardbags,
 * surfpacks, leashes, apparel, accessories). `prefix` is the section slug used in
 * each section's DOM id (e.g. "wetsuits" → "sell-wetsuits-section-photos-title").
 */
export function buildSellSectionNavItems(
  prefix: string,
  detailsLabel: string,
): readonly SellSectionNavItem[] {
  return [
    { id: `sell-${prefix}-section-photos-title`, label: "Photos & title", shortLabel: "Start" },
    { id: `sell-${prefix}-section-details`, label: detailsLabel, shortLabel: "Details" },
    { id: `sell-${prefix}-section-delivery`, label: "Pickup & shipping", shortLabel: "Delivery" },
    { id: `sell-${prefix}-section-publish`, label: "Price & publish", shortLabel: "Publish" },
  ]
}

export const SELL_FORM_SECTION_NAV_ITEMS: readonly SellSectionNavItem[] = [
  {
    id: "sell-section-basics",
    label: "Brand, model & shape",
    shortLabel: "Basics",
  },
  {
    id: "sell-section-details",
    label: "Dimensions & details",
    shortLabel: "Details",
  },
  { id: "sell-section-delivery", label: "Pickup & shipping", shortLabel: "Delivery" },
  {
    id: "sell-section-publish",
    label: "Title, photos & publish",
    shortLabel: "Publish",
  },
]

/**
 * Tablet (md–lg): horizontal stepper (circles, checkmarks, connector); hidden on small phones
 * and replaced by the vertical rail at lg+.
 */
export function SellSectionNavHorizontal({
  items,
  sectionCompletion,
  activeSectionId,
  onSelectSection,
  className,
}: {
  items: readonly SellSectionNavItem[]
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  /** When set, highlights the current wizard step. */
  activeSectionId?: string | null
  /** Wizard mode: jump steps instead of scrolling to section anchors. */
  onSelectSection?: (sectionId: string) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn(
        "rounded-lg border border-border bg-card py-3 shadow-surface",
        className,
      )}
    >
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        <ol className="mx-auto flex w-max min-w-full items-start justify-center gap-0 px-3 pb-0.5 pt-0.5 sm:px-4">
          {items.map((item, index) => {
            const complete = sectionCompletion?.[item.id] === true
            const active = activeSectionId === item.id
            const label = item.shortLabel ?? item.label
            return (
              <li key={item.id} className="flex items-start">
                {index > 0 ? (
                  <div
                    className="mt-2.5 h-px w-2 shrink-0 bg-midgray/40 sm:w-3"
                    aria-hidden
                  />
                ) : null}
                <div className="flex w-[3rem] shrink-0 flex-col items-center px-0.5 sm:w-14">
                  <button
                    type="button"
                    onClick={() => selectSection(item.id, onSelectSection)}
                    aria-current={active ? "step" : undefined}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white transition-all hover:opacity-90",
                        complete
                          ? "bg-listingHeart"
                          : active
                            ? "border-2 border-listingHeart"
                            : "border-2 border-midgray/60",
                      )}
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3 w-3 text-white"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-listingHeart" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "w-full text-center text-[10px] leading-tight sm:text-xs",
                        active ? "font-semibold text-foreground" : "text-foreground",
                      )}
                    >
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
 * Desktop sidebar: vertical stepper (bold rail + rings) with section labels; completed steps are solid blue with a check.
 */
export function SellSectionNav({
  items,
  sectionCompletion,
  activeSectionId,
  onSelectSection,
  className,
}: {
  items: readonly SellSectionNavItem[]
  /** When set, keys are section ids (see `SELL_FORM_SECTION_NAV_ITEMS`); completed steps render a check. */
  sectionCompletion?: Readonly<Partial<Record<string, boolean>>>
  /** When set, highlights the current wizard step. */
  activeSectionId?: string | null
  /** Wizard mode: jump steps instead of scrolling to section anchors. */
  onSelectSection?: (sectionId: string) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Listing form sections"
      className={cn("sticky top-24", className)}
    >
      <div className="w-full overflow-auto px-3 py-6 xl:px-4">
        <div className="relative">
          <div
            className="absolute bottom-3 left-3 top-3 w-[2px] -translate-x-1/2 bg-midgray/30"
            aria-hidden
          />
          <ul className="relative m-0 list-none space-y-8 p-0">
            {items.map((item) => {
              const complete = sectionCompletion?.[item.id] === true
              const active = activeSectionId === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => selectSection(item.id, onSelectSection)}
                    aria-current={active ? "step" : undefined}
                    aria-label={
                      complete ? `${item.label}, completed` : `Go to ${item.label}`
                    }
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-sm text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white transition-all",
                        "group-hover:opacity-90",
                        complete
                          ? "bg-listingHeart"
                          : active
                            ? "border-2 border-listingHeart shadow-sm"
                            : "border-2 border-midgray/60",
                      )}
                      aria-hidden
                    >
                      {complete ? (
                        <Check
                          className="h-3.5 w-3.5 text-white"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : active ? (
                        <span className="h-2 w-2 rounded-full bg-listingHeart" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 max-w-[13rem] pt-1 text-sm leading-snug text-black group-hover:underline group-hover:underline-offset-4",
                        active && "font-semibold",
                      )}
                    >
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
