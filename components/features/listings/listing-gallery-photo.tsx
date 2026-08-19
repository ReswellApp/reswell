"use client"

import Image from "next/image"
import { useState } from "react"
import { ListingTileShimmer } from "@/components/ui/skeleton"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"

export interface ListingGalleryPhotoProps {
  src: string
  /** Browse/tile URL — often already in cache from the feed the user just left. */
  previewSrc?: string
  alt: string
  sizes: string
  className?: string
  priority?: boolean
  fetchPriority?: "high" | "low" | "auto"
  loading?: "eager" | "lazy"
  onLoaded?: (size: { naturalWidth: number; naturalHeight: number }) => void
}

function markReadyIfComplete(img: HTMLImageElement | null, mark: () => void): void {
  if (img?.complete && img.naturalWidth > 0) mark()
}

function rememberSize(
  img: { naturalWidth: number; naturalHeight: number },
  onLoaded?: ListingGalleryPhotoProps["onLoaded"],
): void {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    onLoaded?.({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
  }
}

/**
 * Listing gallery photo. The wave skeleton is the canvas — bitmaps stay invisible
 * until they have actually painted, so the well never flashes white/grey.
 */
export function ListingGalleryPhoto({
  src,
  previewSrc,
  alt,
  sizes,
  className,
  priority = false,
  fetchPriority,
  loading,
  onLoaded,
}: ListingGalleryPhotoProps) {
  const [trackedSrc, setTrackedSrc] = useState(src)
  const [previewReady, setPreviewReady] = useState(false)
  const [srcReady, setSrcReady] = useState(false)

  if (src !== trackedSrc) {
    setTrackedSrc(src)
    setPreviewReady(false)
    setSrcReady(false)
  }

  const preview =
    previewSrc && previewSrc !== src && previewSrc !== "/placeholder.svg" ? previewSrc : ""
  const painted = srcReady || previewReady

  return (
    <>
      {preview ? (
        <Image
          key={`preview-${preview}`}
          src={preview}
          alt=""
          fill
          unoptimized={listingImageShouldBypassOptimization(preview)}
          draggable={false}
          aria-hidden
          className={cn(
            "pointer-events-none bg-transparent select-none object-cover object-center",
            className,
            previewReady && !srcReady ? "opacity-100" : "opacity-0",
          )}
          sizes={sizes}
          loading={priority ? "eager" : loading}
          ref={(img) => markReadyIfComplete(img, () => setPreviewReady(true))}
          onLoadingComplete={(img) => {
            setPreviewReady(true)
            rememberSize(img, onLoaded)
          }}
        />
      ) : null}
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        unoptimized={listingImageShouldBypassOptimization(src)}
        draggable={false}
        className={cn(
          "pointer-events-none bg-transparent select-none object-cover object-center transition-opacity duration-200 ease-out",
          className,
          srcReady ? "opacity-100" : "opacity-0",
        )}
        sizes={sizes}
        priority={priority}
        fetchPriority={fetchPriority}
        loading={loading}
        ref={(img) => markReadyIfComplete(img, () => setSrcReady(true))}
        onLoadingComplete={(img) => {
          setSrcReady(true)
          rememberSize(img, onLoaded)
        }}
      />
      <ListingTileShimmer
        aria-hidden
        className={cn(
          "listing-tile-shimmer-overlay absolute inset-0 z-[3] rounded-none",
          painted && "pointer-events-none opacity-0",
        )}
      />
    </>
  )
}
