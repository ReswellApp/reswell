"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { cn } from "@/lib/utils"
import type { BrandRow } from "@/lib/brands/types"

export type TrendingStripBrand = Pick<BrandRow, "id" | "slug" | "name" | "logo_url">

const TILE_MIN_W = "min-w-[6.5rem] max-w-[9.5rem] sm:min-w-[7.5rem] sm:max-w-[10.5rem]"

function splitRows(brands: TrendingStripBrand[]): { row1: TrendingStripBrand[]; row2: TrendingStripBrand[] } {
  if (brands.length === 0) return { row1: [], row2: [] }
  const cut = Math.ceil(brands.length / 2)
  return { row1: brands.slice(0, cut), row2: brands.slice(cut) }
}

function BrandCell({ b }: { b: TrendingStripBrand }) {
  return (
    <li className={cn("shrink-0 list-none", TILE_MIN_W)}>
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
                src={b.logo_url}
                alt=""
                fill
                className="object-contain object-center"
                sizes="(max-width: 640px) 112px, 120px"
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
    </li>
  )
}

function BrandRow({ brands }: { brands: TrendingStripBrand[] }) {
  if (brands.length === 0) return null
  return (
    <ul className="flex w-max min-w-0 flex-nowrap items-end justify-start gap-7 sm:gap-10">
      {brands.map((b) => (
        <BrandCell key={b.id} b={b} />
      ))}
    </ul>
  )
}

/**
 * Two-row, horizontally scrollable brand strip (homepage “Trending brands” carousel).
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

  const { row1, row2 } = splitRows(brands)

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
    // Instant step avoids a smooth-scroll “middle” where both arrows apply — that read as a UI flicker.
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: "auto" })
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
      {/* Relative box so chevrons stay locked to the vertical center of the two logo rows (inset-y-0),
          not a flex lane that re-centers when 1 vs 2 buttons are mounted. */}
      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          className="min-w-0 overflow-x-auto overflow-y-hidden pr-9 [scrollbar-width:none] sm:pr-10 [&::-webkit-scrollbar]:hidden"
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
          <div className="inline-flex w-max min-w-0 flex-col gap-5">
            <BrandRow brands={row1} />
            <BrandRow brands={row2} />
          </div>
        </div>

        {showNav ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex w-8 flex-col items-center justify-center gap-0.5">
            <nav className="pointer-events-auto flex flex-col items-center justify-center gap-0.5" aria-label="Scroll trending brands">
              {canPrev ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm"
                  onClick={() => scrollBy("prev")}
                  aria-label="Scroll brands left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : null}
              {canNext ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm"
                  onClick={() => scrollBy("next")}
                  aria-label="Scroll brands right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : null}
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  )
}
