"use client"

import type { MouseEventHandler } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ICON_CLASS = "h-4 w-4 shrink-0"

export type ListingImageCarouselNavVariant = "embed" | "lightbox" | "chrome"

export interface ListingImageCarouselNavButtonProps {
  direction: "prev" | "next"
  variant: ListingImageCarouselNavVariant
  /** Horizontal offset, e.g. `left-2` or `left-1 sm:left-3` */
  sideClassName?: string
  onClick: MouseEventHandler<HTMLButtonElement>
  srLabel: string
  /** When true, skip absolute centering so the parent can place the control. */
  staticPosition?: boolean
}

export function ListingImageCarouselNavButton({
  direction,
  variant,
  sideClassName,
  onClick,
  srLabel,
  staticPosition = false,
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
        "h-8 w-8 rounded-full",
        staticPosition ? "relative shrink-0" : "absolute top-1/2 -translate-y-1/2",
        sideClassName,
        isEmbed &&
          "z-10 opacity-80 hover:opacity-100",
        variant === "lightbox" &&
          "z-20 border border-white/80 bg-white/75 text-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.14)] backdrop-blur-md transition-[background-color,transform,color] hover:bg-white/95 hover:text-black active:scale-[0.98] [&_svg]:stroke-[2]",
        variant === "chrome" &&
          "z-30 h-11 w-11 border border-border/55 bg-background/90 text-foreground shadow-sm backdrop-blur-md hover:bg-muted/40 [&_svg]:size-[18px] [&_svg]:stroke-[2]",
      )}
    >
      <Icon className={ICON_CLASS} aria-hidden />
      <span className="sr-only">{srLabel}</span>
    </Button>
  )
}
