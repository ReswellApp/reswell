"use client"

import * as React from "react"
import Image from "next/image"

import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

/** Trending brand as shown on the `/sell` start screen (from `home_trending_brands`). */
export type SellTrendingBrand = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

/**
 * Clickable trending-brand slider under the `/sell` search box: tapping a
 * brand drills into that brand's catalog models instead of navigating away.
 */
export function SellTrendingBrandsSlider({
  brands,
  onSelect,
  className,
}: {
  brands: SellTrendingBrand[]
  onSelect: (brand: SellTrendingBrand) => void
  className?: string
}) {
  if (brands.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-left text-sm text-muted-foreground">Trending brands</p>
      <ul
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
        aria-label="Trending brands"
      >
        {brands.map((brand) => {
          const displaySrc = brand.logoUrl?.trim()
            ? brandLogoDisplaySrc(brand.logoUrl)
            : null
          return (
            <li key={brand.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onSelect(brand)}
                className={cn(
                  "flex w-[5.75rem] flex-col items-center gap-1 rounded-xl border border-border/70 bg-background px-2 py-2 transition-colors sm:w-auto sm:px-3 sm:py-2.5",
                  "hover:border-cerulean/40 hover:bg-muted/40 focus-visible:border-cerulean/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  "active:scale-[0.98]",
                )}
              >
                <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background sm:h-12 sm:w-12">
                  {displaySrc ? (
                    <Image
                      src={displaySrc}
                      alt={brand.name}
                      fill
                      className="object-contain p-1.5"
                      sizes="48px"
                      unoptimized={listingImageShouldBypassOptimization(displaySrc)}
                    />
                  ) : (
                    <span className="text-sm font-bold text-cerulean">
                      {brand.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-foreground sm:max-w-[5.5rem] sm:text-xs">
                  {brand.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
