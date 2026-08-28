"use client"

import * as React from "react"
import Link from "next/link"
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
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <Link
          href="/we-buy"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#001A4A]/15 bg-[#F4F7FB] px-4 py-3 text-left transition hover:border-[#001A4A]/35"
        >
          <span>
            <span className="block text-sm font-semibold text-[#001A4A]">We’ll buy your surfboard</span>
            <span className="block text-xs text-[#5c6b89]">
              Quote in under 30 minutes. Prepaid label. Paid to your wallet.
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-[#001A4A]">Get a quote →</span>
        </Link>
      </div>
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
