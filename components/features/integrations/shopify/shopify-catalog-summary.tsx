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
    <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Listing filters">
      {filters.map((item) => {
        const active = activeFilter === item.filter
        return (
          <button
            key={item.filter}
            type="button"
            onClick={() => onFilterChange(item.filter)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] leading-5",
              active
                ? "border-[#202223] bg-[#202223] font-medium text-white dark:border-foreground dark:bg-foreground dark:text-background"
                : "border-[#c9cccf] bg-white font-medium text-[#202223] hover:bg-[#f6f6f7] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted",
              !active && item.tone === "alert" && "border-[#d72c0d] text-[#d72c0d]",
            )}
          >
            {item.label}
            <span
              className={cn(
                "tabular-nums",
                active ? "text-white/80 dark:text-background/80" : "text-[#6d7175] dark:text-muted-foreground",
                !active && item.tone === "alert" && "text-[#d72c0d]",
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
