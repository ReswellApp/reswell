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
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl bg-gradient-to-b from-muted/60 via-muted/30 to-background p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] ring-1 ring-black/[0.04]",
        )}
      >
        <button
          type="button"
          onClick={flip}
          className={cn(
            "relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[0.875rem] bg-background/80 text-left",
            "max-w-none",
            "cursor-pointer transition-[box-shadow,transform] duration-300 hover:shadow-soft-hover active:scale-[0.998]",
            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2",
          )}
          aria-label={
            side === "deck"
              ? "Deck view. Click image to show bottom."
              : "Bottom view. Click image to show deck."
          }
        >
          <Image
            key={src}
            src={src}
            alt={`${modelName} — ${side === "deck" ? "Deck" : "Bottom"}`}
            fill
            className="object-contain object-center p-5 sm:p-8"
            sizes="(max-width: 1024px) 85vw, 22rem"
            priority
          />
        </button>
      </div>

      <div
        className="flex rounded-xl border border-border/70 bg-muted/20 p-1 shadow-inner"
        role="group"
        aria-label="Choose deck or bottom"
      >
        <button
          type="button"
          onClick={() => setSide("deck")}
          aria-pressed={side === "deck"}
          className={cn(
            "min-h-touch flex-1 rounded-lg py-2.5 text-center text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-200",
            side === "deck"
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Deck
        </button>
        <button
          type="button"
          onClick={() => setSide("bottom")}
          aria-pressed={side === "bottom"}
          className={cn(
            "min-h-touch flex-1 rounded-lg py-2.5 text-center text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-200",
            side === "bottom"
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/[0.06]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Bottom
        </button>
      </div>
    </div>
  )
}
