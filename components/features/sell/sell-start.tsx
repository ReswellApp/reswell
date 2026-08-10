"use client"

import * as React from "react"
import { SellCatalogSearch } from "@/components/features/sell/sell-catalog-search"
import type { SellTrendingBrand } from "@/components/features/sell/sell-trending-brands"
import { SellContinueDrafts } from "@/components/features/sell/sell-continue-drafts"
import { resolveSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"

/**
 * `/sell` hub — drafts + catalog search, type links, then trending brands.
 * Surfboard entry is experience-based (Quick for guests/first listing, Guided after).
 */
export function SellStart({
  isAdmin = false,
  trendingBrands = [],
  surfboardSellHref,
}: {
  isAdmin?: boolean
  trendingBrands?: SellTrendingBrand[]
  /** From {@link resolveDefaultSurfboardSellCreatePath}. */
  surfboardSellHref: string
}) {
  React.useEffect(() => {
    // Stamp session entry once so downstream flow_started rows join cleanly.
    // Prefer URL (`from=nav`, `new=1`) — see sell-entry-point.ts.
    resolveSellEntryPoint()
  }, [])

  return (
    <div className="flex-1 bg-offwhite">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-10">
        <SellContinueDrafts className="mb-8" />
      </div>
      <SellCatalogSearch
        isAdmin={isAdmin}
        trendingBrands={trendingBrands}
        surfboardSellHref={surfboardSellHref}
      />
    </div>
  )
}
