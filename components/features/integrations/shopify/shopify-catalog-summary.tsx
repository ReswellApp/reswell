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

export function ShopifyCatalogSummaryTiles({
  summary,
  activeFilter,
  onFilterChange,
}: ShopifyCatalogSummaryProps) {
  const tiles: Array<{
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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => (
        <button
          key={tile.filter}
          type="button"
          onClick={() => onFilterChange(tile.filter)}
          aria-pressed={activeFilter === tile.filter}
          className={cn(
            "rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/60",
            activeFilter === tile.filter && "border-foreground/30 bg-muted/60",
          )}
        >
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums text-foreground",
              tile.tone === "alert" && "text-red-600 dark:text-red-400",
            )}
          >
            {tile.value}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{tile.label}</p>
        </button>
      ))}
    </div>
  )
}
