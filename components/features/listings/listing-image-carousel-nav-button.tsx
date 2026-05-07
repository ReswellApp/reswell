"use client"

import type { MouseEventHandler } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ICON_CLASS = "h-4 w-4 shrink-0"

export type ListingImageCarouselNavVariant = "embed" | "lightbox"

export interface ListingImageCarouselNavButtonProps {
  direction: "prev" | "next"
  variant: ListingImageCarouselNavVariant
  /** Horizontal offset, e.g. `left-2` or `left-1 sm:left-3` */
  sideClassName: string
  onClick: MouseEventHandler<HTMLButtonElement>
  srLabel: string
}

export function ListingImageCarouselNavButton({
  direction,
  variant,
  sideClassName,
  onClick,
  srLabel,
}: ListingImageCarouselNavButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  const isEmbed = variant === "embed"

  return (
    <Button
      type="button"
      variant={isEmbed ? "secondary" : "ghost"}
      size="icon"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full",
        sideClassName,
        isEmbed &&
          "z-10 opacity-80 hover:opacity-100",
        variant === "lightbox" &&
          "z-20 border border-white/80 bg-white/75 text-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.14)] backdrop-blur-md transition-[background-color,transform,color] hover:bg-white/95 hover:text-neutral-950 active:scale-[0.98] [&_svg]:stroke-[2]",
      )}
    >
      <Icon className={ICON_CLASS} aria-hidden />
      <span className="sr-only">{srLabel}</span>
    </Button>
  )
}
