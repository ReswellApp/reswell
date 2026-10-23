"use client"

import type {
  ShopifyCatalogSummary,
  ShopifyLinkedListingFilter,
} from "@/lib/shopify/types"
import { cn } from "@/lib/utils"

interface ShopifyCatalogSummaryProps {
  summary: ShopifyCatalogSummary
  activeFilter: ShopifyLinkedListingFilter
  onFilterChange: (filter: ShopifyLinkedListingFilter) => void
}

export function ShopifyCatalogSummary({
  summary,
  activeFilter,
  onFilterChange,
}: ShopifyCatalogSummaryProps) {
  const filters: Array<{
    filter: ShopifyLinkedListingFilter
    label: string
    value: number
    tone?: "alert"
  }> = [
    { filter: "all", label: "All", value: summary.total },
    { filter: "live", label: "Live", value: summary.live },
    { filter: "out_of_stock", label: "Out of stock", value: summary.outOfStock },
    { filter: "deleted", label: "Deleted", value: summary.deleted },
    { filter: "unpublished", label: "Unpublished", value: summary.unpublished },
    {
      filter: "error",
      label: "Sync errors",
      value: summary.errors,
      tone: summary.errors > 0 ? "alert" : undefined,
    },
  ]

  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-1"
      role="toolbar"
      aria-label="Listing filters"
    >
      {filters.map((item) => {
        const active = activeFilter === item.filter
        return (
          <button
            key={item.filter}
            type="button"
            onClick={() => onFilterChange(item.filter)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[13px] leading-5",
              active
                ? "bg-[#303030] font-medium text-white dark:bg-foreground dark:text-background"
                : "font-medium text-[#303030] hover:bg-[#f1f1f1] dark:text-foreground dark:hover:bg-muted",
              !active && item.tone === "alert" && "text-[#8e1f0b]",
            )}
          >
            {item.label}
            <span
              className={cn(
                "tabular-nums",
                active ? "text-white/70 dark:text-background/70" : "text-[#616161] dark:text-muted-foreground",
                !active && item.tone === "alert" && "text-[#8e1f0b]",
              )}
            >
              {item.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}
