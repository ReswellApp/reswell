"use client"

import Image from "next/image"
import { useCallback, useLayoutEffect, useRef, useState, type SyntheticEvent } from "react"
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
  // Index into [slot.src, ...slot.fallbackSrcs]; advances when an image fails to load.
  const [candidateIndex, setCandidateIndex] = useState(0)
  const frameRef = useRef<HTMLDivElement>(null)

  const handleLoad = useCallback((_event: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
  }, [])

  const handleError = useCallback((_event: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(false)
    setCandidateIndex((index) => index + 1)
  }, [])

  const candidates = [slot.src, ...(slot.fallbackSrcs ?? [])].filter((url) => url.length > 0)
  const src = candidates[candidateIndex]

  useLayoutEffect(() => {
    const img = frameRef.current?.querySelector("img")
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  if (!src) {
    return <div className={cn("bg-muted", className)} aria-hidden />
  }

  const showShimmer = !loaded

  return (
    <div ref={frameRef} className={cn("relative min-h-0 overflow-hidden bg-muted", className)}>
      <Image
        key={src}
        src={src}
        alt={slot.alt}
        fill
        sizes={sizes}
        className="object-cover object-center"
        unoptimized={listingImageShouldBypassOptimization(src)}
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) {
            setLoaded(true)
          }
        }}
        onLoad={handleLoad}
        onError={handleError}
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
