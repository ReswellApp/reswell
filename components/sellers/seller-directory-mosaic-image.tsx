"use client"

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react"
import { ListingMediaFillImage } from "@/components/listing-media-fill-image"
import { useCachedPhotoReady } from "@/components/features/listings/hooks/use-cached-photo-ready"
import type { SellerDirectoryMosaicSlot } from "@/lib/sellers/directory-mosaic-images"
import { cn } from "@/lib/utils"

type SellerDirectoryMosaicImageProps = {
  slot: SellerDirectoryMosaicSlot
  className?: string
  sizes: string
  priority?: boolean
  /** Fired when every candidate URL for this cover has failed. */
  onExhausted?: () => void
}

/** Mosaic cell imagery — wave shimmer overlay while photos load (matches {@link ListingTileImageMedia}). */
export function SellerDirectoryMosaicImage({
  slot,
  className,
  sizes,
  priority,
  onExhausted,
}: SellerDirectoryMosaicImageProps) {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const exhaustedRef = useRef(false)

  const candidatesKey = slot.candidates.join("|")
  const candidatesKeyRef = useRef(candidatesKey)
  let resolvedIndex = candidateIndex
  if (candidatesKeyRef.current !== candidatesKey) {
    candidatesKeyRef.current = candidatesKey
    resolvedIndex = 0
    exhaustedRef.current = false
    if (candidateIndex !== 0) setCandidateIndex(0)
  }

  const src = slot.candidates[resolvedIndex] ?? ""
  const { ready, markReady } = useCachedPhotoReady(src)

  useEffect(() => {
    if (src || slot.candidates.length > 0 || exhaustedRef.current) return
    exhaustedRef.current = true
    onExhausted?.()
  }, [src, slot.candidates.length, onExhausted])

  const handleLoad = useCallback(() => {
    markReady(src)
  }, [markReady, src])

  const handleError = useCallback(
    (_event: SyntheticEvent<HTMLImageElement>) => {
      if (candidateIndex + 1 < slot.candidates.length) {
        setCandidateIndex((index) => index + 1)
        return
      }
      if (exhaustedRef.current) return
      exhaustedRef.current = true
      onExhausted?.()
    },
    [candidateIndex, slot.candidates.length, onExhausted],
  )

  if (!src) {
    return <div className={cn("bg-muted", className)} aria-hidden />
  }

  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-muted", className)}>
      <ListingMediaFillImage
        key={src}
        src={src}
        alt={slot.alt}
        sizes={sizes}
        className="object-cover"
        style={slot.objectPosition ? { objectPosition: slot.objectPosition } : undefined}
        ref={(img) => {
          if (img?.complete && img.naturalWidth > 0) markReady(src)
        }}
        onLoad={handleLoad}
        onError={handleError}
        priority={priority}
      />

      {ready ? null : (
        <div className="listing-tile-shimmer absolute inset-0 z-[3]" aria-hidden />
      )}
    </div>
  )
}
