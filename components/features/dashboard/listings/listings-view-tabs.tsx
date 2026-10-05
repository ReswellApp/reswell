"use client"

import { cn } from "@/lib/utils"

export type ListingsDeskView = "basic" | "advanced"

interface ListingsViewTabsProps {
  value: ListingsDeskView
  onChange: (view: ListingsDeskView) => void
}

const TABS: { id: ListingsDeskView; label: string; hint: string }[] = [
  {
    id: "basic",
    label: "Basic",
    hint: "Inventory, drafts, and the actions you use most.",
  },
  {
    id: "advanced",
    label: "Advanced",
    hint: "Analytics, shop tools, package sizes, and edits that save on their own.",
  },
]

export function ListingsViewTabs({ value, onChange }: ListingsViewTabsProps) {
  const active = TABS.find((tab) => tab.id === value) ?? TABS[0]

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Listings view"
        className="inline-flex w-full rounded-full bg-muted p-1 sm:w-auto"
      >
        {TABS.map((tab) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`listings-view-${tab.id}`}
              aria-selected={selected}
              aria-controls={`listings-view-panel-${tab.id}`}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-5",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-muted-foreground">{active?.hint}</p>
    </div>
  )
}
