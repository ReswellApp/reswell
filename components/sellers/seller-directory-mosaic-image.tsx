"use client"

import Image from "next/image"
import { useCallback, useState, type SyntheticEvent } from "react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { SellerDirectoryMosaicSlot } from "@/lib/sellers/directory-mosaic-images"
import { cn } from "@/lib/utils"

type SellerDirectoryMosaicImageProps = {
  slot: SellerDirectoryMosaicSlot
  className?: string
  sizes: string
  priority?: boolean
}

/** Mosaic cell imagery — wave shimmer overlay while photos load (matches {@link ListingTileImageMedia}). */
export function SellerDirectoryMosaicImage({
  slot,
  className,
  sizes,
  priority,
}: SellerDirectoryMosaicImageProps) {
  const [loaded, setLoaded] = useState(false)

  const handleLoad = useCallback((_event: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
  }, [])

  if (!slot.src) {
    return <div className={cn("bg-muted", className)} aria-hidden />
  }

  const showShimmer = !loaded

  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-muted", className)}>
      <Image
        src={slot.src}
        alt={slot.alt}
        fill
        sizes={sizes}
        className="object-cover object-center"
        unoptimized={listingImageShouldBypassOptimization(slot.src)}
        onLoad={handleLoad}
        onError={handleLoad}
        priority={priority}
      />
      <div
        className={cn(
          "listing-tile-shimmer listing-tile-shimmer-overlay absolute inset-0 z-[3]",
          !showShimmer && "pointer-events-none opacity-0",
        )}
        aria-hidden
      />
    </div>
  )
}
