"use client"

import Image from "next/image"
import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"

type Side = "deck" | "bottom"

export function BoardModelDeckBottomHero({
  modelName,
  deckUrl,
  bottomUrl,
}: {
  modelName: string
  deckUrl: string
  bottomUrl: string
}) {
  const [side, setSide] = useState<Side>("deck")
  const src = side === "deck" ? deckUrl : bottomUrl

  const flip = useCallback(() => {
    setSide((s) => (s === "deck" ? "bottom" : "deck"))
  }, [])

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Product well — Channel Islands–style clean backdrop + tappable hero */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm",
          "dark:border-white/10 dark:bg-zinc-950",
        )}
      >
        <button
          type="button"
          onClick={flip}
          className={cn(
            "relative block aspect-[4/5] w-full cursor-pointer text-left outline-none",
            "transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.997]",
            "focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-label={
            side === "deck"
              ? "Showing deck. Click to show bottom."
              : "Showing bottom. Click to show deck."
          }
        >
          <Image
            key={src}
            src={src}
            alt={`${modelName} — ${side === "deck" ? "Deck" : "Bottom"}`}
            fill
            className="object-contain object-center p-5 sm:p-8 md:p-10"
            sizes="(max-width: 1024px) 85vw, 28rem"
            priority
          />
        </button>
      </div>

      {/* Pill segmented control — matches CI product page pattern */}
      <div
        className={cn(
          "flex h-11 w-full items-stretch overflow-hidden rounded-full border border-black/[0.08] p-1",
          "bg-muted/35 shadow-inner dark:border-white/10 dark:bg-muted/25",
        )}
        role="tablist"
        aria-label="Deck or bottom view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={side === "deck"}
          onClick={() => setSide("deck")}
          className={cn(
            "min-h-touch min-w-0 flex-1 rounded-full px-2 text-center text-[11px] uppercase tracking-[0.16em] transition-all duration-200 sm:text-xs sm:tracking-[0.14em]",
            side === "deck"
              ? "bg-background font-bold text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "font-normal text-muted-foreground hover:text-foreground/85",
          )}
        >
          Deck
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === "bottom"}
          onClick={() => setSide("bottom")}
          className={cn(
            "min-h-touch min-w-0 flex-1 rounded-full px-2 text-center text-[11px] uppercase tracking-[0.16em] transition-all duration-200 sm:text-xs sm:tracking-[0.14em]",
            side === "bottom"
              ? "bg-background font-bold text-foreground shadow-sm ring-1 ring-black/[0.06] dark:ring-white/10"
              : "font-normal text-muted-foreground hover:text-foreground/85",
          )}
        >
          Bottom
        </button>
      </div>
    </div>
  )
}
