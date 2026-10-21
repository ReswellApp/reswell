"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SyntheticEvent } from "react"
import { ListingMediaFillImage } from "@/components/listing-media-fill-image"
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
  const [loaded, setLoaded] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const exhaustedRef = useRef(false)

  const candidatesKey = slot.candidates.join("|")

  useEffect(() => {
    setCandidateIndex(0)
    setLoaded(false)
    exhaustedRef.current = false
  }, [candidatesKey])

  const src = slot.candidates[candidateIndex] ?? ""

  useEffect(() => {
    if (src || slot.candidates.length > 0 || exhaustedRef.current) return
    exhaustedRef.current = true
    onExhausted?.()
  }, [src, slot.candidates.length, onExhausted])

  const handleLoad = useCallback((_event: SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
  }, [])

  const handleError = useCallback(
    (_event: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(false)
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
      <ListingMediaFillImage
        key={src}
        src={src}
        alt={slot.alt}
        sizes={sizes}
        className="object-cover"
        style={slot.objectPosition ? { objectPosition: slot.objectPosition } : undefined}
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
