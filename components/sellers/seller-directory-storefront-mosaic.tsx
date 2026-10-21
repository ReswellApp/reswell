"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { SellerDirectoryMosaicImage } from "@/components/sellers/seller-directory-mosaic-image"
import {
  SELLER_DIRECTORY_MOSAIC_DISPLAY_COUNT,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import { cn } from "@/lib/utils"

const STOREFRONT_SIZES = {
  full: "(max-width: 639px) 50vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw",
  hero: "(max-width: 639px) 32vw, (max-width: 1023px) 32vw, (max-width: 1279px) 22vw, 16vw",
  stack: "(max-width: 639px) 20vw, (max-width: 1023px) 20vw, (max-width: 1279px) 14vw, 10vw",
} as const

type SellerDirectoryStorefrontMosaicProps = {
  slots: SellerDirectoryMosaicSlot[]
  imagePriority?: boolean
  /** When every cover fails, render the monogram panel instead of empty cells. */
  emptyFallback: ReactNode
}

function MosaicCell({
  slot,
  sizes,
  imagePriority,
  className,
  onExhausted,
}: {
  slot: SellerDirectoryMosaicSlot
  sizes: string
  imagePriority?: boolean
  className?: string
  onExhausted: () => void
}) {
  return (
    <div className={cn("relative min-h-0 min-w-0", className)}>
      <SellerDirectoryMosaicImage
        slot={slot}
        className="h-full w-full"
        sizes={sizes}
        priority={imagePriority}
        onExhausted={onExhausted}
      />
    </div>
  )
}

/**
 * Directory storefront grid. Keeps a pool of listing covers and promotes the
 * next one when a cell's candidates all 404 — avoids the empty grey mosaic cell.
 */
export function SellerDirectoryStorefrontMosaic({
  slots,
  imagePriority = false,
  emptyFallback,
}: SellerDirectoryStorefrontMosaicProps) {
  const [exhausted, setExhausted] = useState<Set<number>>(() => new Set())
  const slotsKey = slots.map((slot) => slot.candidates.join("|")).join("||")

  useEffect(() => {
    setExhausted(new Set())
  }, [slotsKey])

  const visible = useMemo(
    () =>
      slots
        .map((slot, index) => ({ slot, index }))
        .filter(
          ({ slot, index }) =>
            !exhausted.has(index) && slot.candidates.some((src) => src.length > 0),
        )
        .slice(0, SELLER_DIRECTORY_MOSAIC_DISPLAY_COUNT),
    [slots, exhausted],
  )

  const markExhausted = useCallback((index: number) => {
    setExhausted((prev) => {
      if (prev.has(index)) return prev
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [])

  if (visible.length === 0) {
    return <>{emptyFallback}</>
  }

  if (visible.length === 1) {
    const only = visible[0]!
    return (
      <MosaicCell
        slot={only.slot}
        sizes={STOREFRONT_SIZES.full}
        imagePriority={imagePriority}
        className="h-full"
        onExhausted={() => markExhausted(only.index)}
      />
    )
  }

  if (visible.length === 2) {
    const [first, second] = visible
    return (
      <div className="grid h-full grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-[3px]">
        <MosaicCell
          slot={first!.slot}
          sizes={STOREFRONT_SIZES.hero}
          imagePriority={imagePriority}
          onExhausted={() => markExhausted(first!.index)}
        />
        <MosaicCell
          slot={second!.slot}
          sizes={STOREFRONT_SIZES.stack}
          onExhausted={() => markExhausted(second!.index)}
        />
      </div>
    )
  }

  const [first, second, third] = visible
  return (
    <div className="grid h-full grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] grid-rows-2 gap-[3px]">
      <MosaicCell
        slot={first!.slot}
        sizes={STOREFRONT_SIZES.hero}
        imagePriority={imagePriority}
        className="row-span-2"
        onExhausted={() => markExhausted(first!.index)}
      />
      <MosaicCell
        slot={second!.slot}
        sizes={STOREFRONT_SIZES.stack}
        onExhausted={() => markExhausted(second!.index)}
      />
      <MosaicCell
        slot={third!.slot}
        sizes={STOREFRONT_SIZES.stack}
        onExhausted={() => markExhausted(third!.index)}
      />
    </div>
  )
}
