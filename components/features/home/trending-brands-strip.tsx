"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { cn } from "@/lib/utils"
import type { BrandRow } from "@/lib/brands/types"
import { brandLogoDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  homeHorizontalScrollOuterClassName,
  homeHorizontalScrollPlDefault,
} from "@/components/features/home/home-listing-scroll-row"

export type TrendingStripBrand = Pick<BrandRow, "id" | "slug" | "name" | "logo_url">

const TILE_MIN_W = "min-w-[6.5rem] max-w-[9.5rem] sm:min-w-[7.5rem] sm:max-w-[10.5rem]"

/**
 * Same “first half / second half” split as the old two-row strip, but as columns so horizontal
 * scroll-snap can align to each brand pair (matches `HomeListingScrollRow` affordance).
 */
function splitIntoColumns(
  brands: TrendingStripBrand[],
): { top: TrendingStripBrand | null; bottom: TrendingStripBrand | null }[] {
  if (brands.length === 0) return []
  const cut = Math.ceil(brands.length / 2)
  const row1 = brands.slice(0, cut)
  const row2 = brands.slice(cut)
  const n = Math.max(row1.length, row2.length)
  return Array.from({ length: n }, (_, i) => ({
    top: row1[i] ?? null,
    bottom: row2[i] ?? null,
  }))
}

function BrandCell({ b }: { b: TrendingStripBrand }) {
  return (
    <div className="w-full min-w-0 shrink-0">
      <Link
        href={`${BRANDS_BASE}/${b.slug}`}
        className="group flex flex-col items-center gap-2.5 text-center no-underline"
      >
        <div
          className="relative flex h-14 w-full max-w-[7rem] items-center justify-center sm:h-16"
          aria-hidden
        >
          {b.logo_url ? (
            <div className="relative h-14 w-full sm:h-16">
              <Image
                src={brandLogoDisplaySrc(b.logo_url)}
                alt=""
                fill
                className="object-contain object-center"
                sizes="(max-width: 640px) 112px, 120px"
                unoptimized={listingImageShouldBypassOptimization(brandLogoDisplaySrc(b.logo_url))}
              />
            </div>
          ) : (
            <div
              className="flex h-14 w-full max-w-[5rem] items-center justify-center rounded-md border border-border/60 bg-muted/40 text-muted-foreground sm:h-16"
              aria-hidden
            >
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
        <span className="w-full line-clamp-2 text-center text-xs font-medium leading-tight text-foreground group-hover:underline">
          {b.name}
        </span>
      </Link>
    </div>
  )
}

/**
 * Two rows (as column pairs), horizontally scrollable with the same full-bleed + snap feel as
 * `HomeListingScrollRow` (recently added surfboards).
 */
/** Pixels of tolerance so subpixel/rounding at scroll extremes doesn’t flash arrow visibility. */
const SCROLL_END_SLOP = 6

type ArrowState = { canPrev: boolean; canNext: boolean }

function computeArrowState(el: HTMLDivElement | null): ArrowState {
  if (!el) return { canPrev: false, canNext: false }
  const { scrollLeft, clientWidth, scrollWidth } = el
  const maxScroll = Math.max(0, scrollWidth - clientWidth)
  if (maxScroll <= 0) return { canPrev: false, canNext: false }
  return {
    canPrev: scrollLeft > SCROLL_END_SLOP,
    canNext: scrollLeft < maxScroll - SCROLL_END_SLOP,
  }
}

export function TrendingBrandsStrip({ brands, className }: { brands: TrendingStripBrand[]; className?: string }) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [arrows, setArrows] = React.useState<ArrowState>({ canPrev: false, canNext: false })
  const rafRef = React.useRef<number | null>(null)

  const columns = splitIntoColumns(brands)

  const updateArrows = React.useCallback(() => {
    const el = scrollRef.current
    const next = computeArrowState(el)
    setArrows((prev) =>
      prev.canPrev === next.canPrev && prev.canNext === next.canNext ? prev : next,
    )
  }, [])

  /** Coalesce per-frame: avoids flicker from multiple scroll event reads mid-smooth-scroll. */
  const scheduleArrows = React.useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateArrows()
    })
  }, [updateArrows])

  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    const ro = new ResizeObserver(() => {
      updateArrows()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [brands, updateArrows])

  const scrollBy = (dir: "prev" | "next") => {
    const el = scrollRef.current
    if (!el) return
    const amount = Math.min(320, Math.max(200, el.clientWidth * 0.45))
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "smooth" })
    requestAnimationFrame(() => updateArrows())
  }

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => scheduleArrows()
    const onScrollEnd = () => updateArrows()
    el.addEventListener("scroll", onScroll, { passive: true })
    el.addEventListener("scrollend", onScrollEnd)
    return () => {
      el.removeEventListener("scroll", onScroll)
      el.removeEventListener("scrollend", onScrollEnd)
    }
  }, [brands, scheduleArrows, updateArrows])

  React.useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  if (brands.length === 0) return null

  const { canPrev, canNext } = arrows
  const showNav = canPrev || canNext

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          className={cn(
            homeHorizontalScrollOuterClassName,
            "touch-pan-x",
            canPrev ? "pl-8 sm:pl-10 lg:pl-10" : homeHorizontalScrollPlDefault,
          )}
          tabIndex={0}
          role="region"
          aria-label="Trending brands"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault()
              scrollBy("next")
            } else if (e.key === "ArrowLeft") {
              e.preventDefault()
              scrollBy("prev")
            }
          }}
        >
          <ul
            className={cn(
              "list-none",
              "flex w-max min-w-0 flex-row items-stretch gap-7 sm:gap-10",
              "snap-x snap-proximity sm:snap-none",
              canNext ? "pr-8 sm:pr-10 lg:pr-10" : "pr-4 sm:pr-6 lg:pr-8",
            )}
            role="list"
          >
            {columns.map((col, i) => {
              const key = `${col.top?.id ?? "t"}-${col.bottom?.id ?? "b"}-${i}`
              return (
                <li
                  key={key}
                  className={cn("snap-start shrink-0", TILE_MIN_W)}
                >
                  <div className="flex min-h-0 w-full min-w-0 flex-col items-center justify-start gap-5">
                    {col.top ? <BrandCell b={col.top} /> : null}
                    {col.bottom ? <BrandCell b={col.bottom} /> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {showNav ? (
          <nav
            className="pointer-events-none absolute inset-y-0 left-0 right-0 z-[1]"
            aria-label="Scroll trending brands"
          >
            {canPrev ? (
              <div className="absolute inset-y-0 left-0 flex w-8 items-center justify-center sm:w-9">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="pointer-events-auto h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm"
                  onClick={() => scrollBy("prev")}
                  aria-label="Scroll brands left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            {canNext ? (
              <div className="absolute inset-y-0 right-0 flex w-8 items-center justify-center sm:w-9">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="pointer-events-auto h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm"
                  onClick={() => scrollBy("next")}
                  aria-label="Scroll brands right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  )
}
