"use client"

import * as React from "react"
import { SellCatalogSearch } from "@/components/features/sell/sell-catalog-search"
import type { SellTrendingBrand } from "@/components/features/sell/sell-trending-brands"
import { SellContinueDrafts } from "@/components/features/sell/sell-continue-drafts"
import { SellFaqSection } from "@/components/features/sell/sell-faq-section"
import { SellHubTitleBar } from "@/components/features/sell/sell-hub-title-bar"
import { SellWhySellSection } from "@/components/features/sell/sell-why-sell-section"
import { resolveSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"

/**
 * `/sell` hub — Reverb-like flow in Reswell style:
 * title bar → catalog search → drafts → why sell → FAQ.
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
    <div className="flex-1 bg-background">
      <SellHubTitleBar />
      <SellCatalogSearch
        isAdmin={isAdmin}
        trendingBrands={trendingBrands}
        surfboardSellHref={surfboardSellHref}
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-2 sm:px-6 sm:pt-0">
        <SellContinueDrafts />
      </div>
      <SellWhySellSection />
      <SellFaqSection />
    </div>
  )
}
