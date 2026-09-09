"use client"

import type { SupportHubCategory, SupportHubCategoryId } from "@/lib/help/help-hub-intents"
import { cn } from "@/lib/utils"

interface SupportHubCategoryGridProps {
  categories: readonly SupportHubCategory[]
  featuredId?: SupportHubCategoryId | null
  onPick: (category: SupportHubCategory) => void
}

export function SupportHubCategoryGrid({
  categories,
  featuredId = null,
  onPick,
}: SupportHubCategoryGridProps) {
  if (categories.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
        No topics matched. Try another search or browse the FAQ.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {categories.map((category) => {
        const featured = category.id === featuredId
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onPick(category)}
            className={cn(
              "flex min-h-[5.75rem] items-center justify-center rounded-2xl px-3.5 py-5 text-center shadow-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2",
              "sm:min-h-[6.5rem] md:min-h-[7rem]",
              featured
                ? "bg-listingHeart text-white shadow-listingHeart/20"
                : "border border-border/70 bg-card text-foreground hover:border-listingHeart/35 hover:bg-listingHeart/[0.04]",
            )}
          >
            <span className="text-[13px] font-semibold leading-snug tracking-tight sm:text-[14px]">
              {category.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}
