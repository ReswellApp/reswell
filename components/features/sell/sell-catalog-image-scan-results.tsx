"use client"

import Image from "next/image"
import type { SellCatalogImageScanResult } from "@/lib/types/sell-catalog-image-scan"
import {
  sellCatalogSearchCategoryLabel,
  sellCatalogSearchRowTitle,
  type SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { sellCatalogImageScanRowThumb } from "@/lib/utils/sell-catalog-image-scan"
import { cn } from "@/lib/utils"

function productTitle(row: SellCatalogSearchResultRow): string {
  if (row.kind === "brand") return row.name
  if (row.kind === "model") return row.name
  return row.modelName
}

function productMeta(row: SellCatalogSearchResultRow): string {
  const category = sellCatalogSearchCategoryLabel(row.category)
  if (row.kind === "brand") return category
  if (row.kind === "model") return `${row.brandName} · ${category}`
  return `${row.brandName} · ${row.variantLabel}`
}

export function SellCatalogImageScanResults({
  result,
  onSelect,
}: {
  result: SellCatalogImageScanResult
  onSelect: (row: SellCatalogSearchResultRow) => void
}) {
  const { extract, rows, matchTier } = result
  const confidencePct = Math.round(extract.confidence * 100)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Photo read
        </p>
        <p className="mt-1 text-base font-semibold text-foreground">{extract.summary}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {extract.brandText ?? "No brand"}
          {extract.modelText ? ` · ${extract.modelText}` : ""}
          {` · ${confidencePct}%`}
        </p>
        {extract.notes ? (
          <p className="mt-1 text-sm text-muted-foreground">{extract.notes}</p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No catalog match for that photo. You can still list the item from the type
          links on /sell.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {matchTier === "similar" ? "Closest catalog matches" : "Catalog matches"}
          </p>
          <ul className="space-y-2">
            {rows.map((row) => {
              const thumb = sellCatalogImageScanRowThumb(row)
              const displaySrc = thumb.url ? brandLogoDisplaySrc(thumb.url) : null
              return (
                <li key={`${row.kind}-${row.id}`}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left",
                      "transition-colors hover:bg-muted/70 focus-visible:outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => onSelect(row)}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                      {displaySrc ? (
                        <Image
                          src={displaySrc}
                          alt={sellCatalogSearchRowTitle(row)}
                          fill
                          className={cn(thumb.isLogo ? "object-contain p-1.5" : "object-cover")}
                          sizes="64px"
                          unoptimized={listingImageShouldBypassOptimization(displaySrc)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-cerulean">
                          {productTitle(row).slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {productTitle(row)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{productMeta(row)}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
