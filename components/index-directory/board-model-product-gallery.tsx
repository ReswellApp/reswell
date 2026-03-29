"use client"

import Image from "next/image"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useState } from "react"
import type { BoardModelGalleryImage } from "@/lib/index-directory/types"
import { cn } from "@/lib/utils"

export function BoardModelProductGallery({
  modelName,
  items,
  hidePillTabs = false,
}: {
  modelName: string
  items: BoardModelGalleryImage[]
  /** When true (e.g. Pyzel): no pill bar — arrows + click-to-advance only. */
  hidePillTabs?: boolean
}) {
  const [current, setCurrent] = useState(0)

  const n = items.length

  const advance = useCallback(() => {
    setCurrent((i) => (i + 1) % n)
  }, [n])

  const goPrev = useCallback(() => {
    setCurrent((i) => (i - 1 + n) % n)
  }, [n])

  const goNext = useCallback(() => {
    setCurrent((i) => (i + 1) % n)
  }, [n])

  if (items.length === 0) return null

  const active = items[current]

  const arrowBtnClass = cn(
    "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full",
    "border border-black/[0.08] bg-background/95 text-foreground shadow-md backdrop-blur-sm",
    "transition-colors hover:bg-background dark:border-white/15 dark:bg-zinc-900/95 dark:hover:bg-zinc-900",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2",
  )

  if (items.length === 1) {
    return (
      <div className="flex flex-col gap-3 sm:gap-4">
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm",
            "dark:border-white/10 dark:bg-zinc-950",
          )}
        >
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={items[0].url}
              alt={`${modelName} — ${items[0].caption}`}
              fill
              className="object-contain object-center p-5 sm:p-8 md:p-10"
              sizes="(max-width: 1024px) 85vw, 28rem"
              priority
            />
          </div>
        </div>
        <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {items[0].caption}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Product well — same shell as Channel Islands deck/bottom hero */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm",
          "dark:border-white/10 dark:bg-zinc-950",
        )}
      >
        <button
          type="button"
          onClick={advance}
          className={cn(
            "relative z-0 block aspect-[4/5] w-full cursor-pointer text-left outline-none",
            "transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.997]",
            "focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-inset",
          )}
          aria-label={`Showing ${active.caption}. Click for next image.`}
        >
          <Image
            key={active.url}
            src={active.url}
            alt={`${modelName} — ${active.caption}`}
            fill
            className="object-contain object-center p-5 sm:p-8 md:p-10"
            sizes="(max-width: 1024px) 85vw, 28rem"
            priority={current === 0}
            draggable={false}
          />
        </button>
        {hidePillTabs ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              className={cn(arrowBtnClass, "left-2 sm:left-3")}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              className={cn(arrowBtnClass, "right-2 sm:right-3")}
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {hidePillTabs ? (
        <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {active.caption}
        </p>
      ) : (
        <div
          className={cn(
            "flex h-11 w-full items-stretch overflow-hidden rounded-full border border-black/[0.08] p-1",
            "bg-muted/35 shadow-inner dark:border-white/10 dark:bg-muted/25",
          )}
          role="tablist"
          aria-label="Product views"
        >
          {items.map((item, i) => (
            <button
              key={item.url}
              type="button"
              role="tab"
              aria-selected={i === current}
              onClick={() => setCurrent(i)}
              className={cn(
                "min-h-touch min-w-0 flex-1 rounded-full px-2 text-center text-[11px] uppercase tracking-[0.16em] transition-all duration-200 sm:text-xs sm:tracking-[0.14em]",
                i === current
                  ? "bg-background font-bold text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
                  : "font-normal text-muted-foreground hover:text-foreground/85",
              )}
            >
              <span className="line-clamp-1">{item.caption}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
