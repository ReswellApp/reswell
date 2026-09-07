"use client"

import * as React from "react"
import { Children, isValidElement, type ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { CategoryTopShopsImageWarmProvider } from "@/components/features/browse/category-top-shops-image-warm"
import {
  homeHorizontalScrollOuterClassName,
  homeHorizontalScrollPlDefault,
} from "@/components/features/home/home-listing-scroll-row"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TILE_WIDTH = "w-[9.25rem] sm:w-44"
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

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

export function CategoryTopShopsCarousel({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [arrows, setArrows] = React.useState<ArrowState>({ canPrev: false, canNext: false })
  const rafRef = React.useRef<number | null>(null)

  const updateArrows = React.useCallback(() => {
    const el = scrollRef.current
    const next = computeArrowState(el)
    setArrows((prev) =>
      prev.canPrev === next.canPrev && prev.canNext === next.canNext ? prev : next,
    )
  }, [])

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
  }, [children, updateArrows])

  const scrollBy = (dir: "prev" | "next") => {
    const el = scrollRef.current
    if (!el) return
    const amount = Math.min(360, Math.max(220, el.clientWidth * 0.7))
    el.scrollBy({ left: dir === "next" ? amount : -amount, behavior: scrollBehavior() })
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
  }, [children, scheduleArrows, updateArrows])

  React.useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const tiles = Children.toArray(children).filter((child) => isValidElement(child))
  if (tiles.length === 0) return null

  const { canPrev, canNext } = arrows
  const hasOverflow = canPrev || canNext

  return (
    <CategoryTopShopsImageWarmProvider scrollRef={scrollRef}>
      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          className={cn(
            homeHorizontalScrollOuterClassName,
            homeHorizontalScrollPlDefault,
            // Native momentum only — CSS `scroll-smooth` + snap made trackpad/touch hitch.
            "scroll-auto select-none [-webkit-overflow-scrolling:touch]",
          )}
          tabIndex={0}
          role="region"
          aria-label={label}
          onDragStart={(event) => {
            event.preventDefault()
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault()
              scrollBy("next")
            } else if (event.key === "ArrowLeft") {
              event.preventDefault()
              scrollBy("prev")
            }
          }}
        >
          <ul className="flex w-max list-none items-stretch gap-4 pr-4 sm:gap-5 sm:pr-6 lg:pr-8">
            {tiles.map((child, index) => (
              <li
                key={isValidElement(child) && child.key != null ? child.key : index}
                className={cn("shrink-0", TILE_WIDTH)}
              >
                {child}
              </li>
            ))}
          </ul>
        </div>

        {hasOverflow ? (
          <nav
            className="pointer-events-none absolute inset-y-0 left-0 right-0 z-[1]"
            aria-label={`Scroll ${label}`}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 flex w-8 items-center justify-center transition-opacity duration-150 sm:w-9",
                canPrev ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm",
                  canPrev ? "pointer-events-auto" : "pointer-events-none",
                )}
                tabIndex={canPrev ? 0 : -1}
                aria-hidden={!canPrev}
                onClick={() => scrollBy("prev")}
                aria-label="Previous shops"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div
              className={cn(
                "absolute inset-y-0 right-0 flex w-8 items-center justify-center transition-opacity duration-150 sm:w-9",
                canNext ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full border-border/80 bg-background shadow-sm",
                  canNext ? "pointer-events-auto" : "pointer-events-none",
                )}
                tabIndex={canNext ? 0 : -1}
                aria-hidden={!canNext}
                onClick={() => scrollBy("next")}
                aria-label="Next shops"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </CategoryTopShopsImageWarmProvider>
  )
}
