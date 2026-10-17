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
    { filter: "all", label: "Linked variants", value: summary.total },
    { filter: "live", label: "Live on Reswell", value: summary.live },
    { filter: "out_of_stock", label: "Out of stock", value: summary.outOfStock },
    { filter: "deleted", label: "Deleted in Shopify", value: summary.deleted },
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
      className="flex flex-wrap border-b border-[#e1e3e5] px-1 dark:border-border"
      role="toolbar"
      aria-label="Listing summary"
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
              "-mb-px inline-flex items-baseline gap-1.5 border-b-2 px-2.5 py-2 text-[13px] leading-5",
              active
                ? "border-[#202223] font-semibold text-[#202223] dark:border-foreground dark:text-foreground"
                : "border-transparent font-medium text-[#6d7175] hover:text-[#202223] dark:text-muted-foreground dark:hover:text-foreground",
              item.tone === "alert" && "text-[#d72c0d] dark:text-red-400",
            )}
          >
            {item.label}
            <span className="tabular-nums">{item.value}</span>
          </button>
        )
      })}
    </div>
  )
}
