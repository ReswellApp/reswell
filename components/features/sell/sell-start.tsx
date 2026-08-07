"use client"

import * as React from "react"
import { SellCatalogSearch } from "@/components/features/sell/sell-catalog-search"
import type { SellTrendingBrand } from "@/components/features/sell/sell-trending-brands"
import { SellTypeChooser } from "@/components/features/sell/sell-type-chooser"
import { SellContinueDrafts } from "@/components/features/sell/sell-continue-drafts"
import { resolveSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"

/**
 * `/sell` hub — drafts-first command center, then catalog search / type chooser.
 * `?new=1` opens the type chooser; bare `/sell` leads with Continue + search.
 */
export function SellStart({
  isAdmin = false,
  trendingBrands = [],
  initialMode = "search",
  initialSurfboardPath = false,
}: {
  isAdmin?: boolean
  trendingBrands?: SellTrendingBrand[]
  /** `choose` when arriving from Create listing CTAs (`?new=1`). */
  initialMode?: "search" | "choose"
  /** Open the Quick vs Full surfboard picker on entry (`?choose=surfboard`). */
  initialSurfboardPath?: boolean
}) {
  const [mode, setMode] = React.useState<"search" | "choose">(initialMode)

  React.useEffect(() => {
    // Stamp session entry once so downstream Quick/Full flow_started rows join cleanly.
    // Prefer URL (`from=nav`, `new=1`) over mode — see sell-entry-point.ts.
    resolveSellEntryPoint()
  }, [])

  if (mode === "choose") {
    return (
      <>
        <div className="mx-auto w-full max-w-2xl px-4 pt-6">
          <SellContinueDrafts />
        </div>
        <SellTypeChooser
          isAdmin={isAdmin}
          initialSurfboardPath={initialSurfboardPath}
          onBackToSearch={() => setMode("search")}
        />
      </>
    )
  }

  return (
    <div className="flex-1 bg-offwhite">
      <div className="mx-auto w-full max-w-2xl px-4 pt-8 sm:pt-10">
        <SellContinueDrafts className="mb-8" />
      </div>
      <SellCatalogSearch
        onSkip={() => setMode("choose")}
        trendingBrands={trendingBrands}
      />
    </div>
  )
}
