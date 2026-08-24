"use client"

import Image from "next/image"
import { useState, type CSSProperties, type DragEvent } from "react"
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

const PHOTO_LAYER =
  "bg-transparent select-none object-cover object-center backface-hidden transform-gpu [-webkit-user-drag:none]"

/** Block HTML image-drag so Embla swipe still owns the pointer. Right-click is unchanged. */
export function preventNativeListingImageDrag(event: DragEvent<HTMLImageElement>): void {
  event.preventDefault()
}

/**
 * CSS backdrop so the first compositor frame can show a cached listing photo
 * without waiting on React load state (avoids the white well).
 */
export function listingPhotoBackdropStyle(
  src: string | undefined,
  fit: "cover" | "contain" = "cover",
): CSSProperties | undefined {
  if (!src || src === "/placeholder.svg") return undefined
  const safe = src.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return {
    backgroundImage: `url("${safe}")`,
    backgroundSize: fit,
    backgroundPosition: fit === "contain" ? "center top" : "center",
    backgroundRepeat: "no-repeat",
  }
}

/** Sync cache probe — `img.complete` is true on the first tick when the URL is already in memory. */
export function listingPhotoIsCached(src: string | undefined): boolean {
  if (!src || src === "/placeholder.svg" || typeof window === "undefined") return false
  const probe = new window.Image()
  probe.src = src
  return probe.complete && probe.naturalWidth > 0
}

function markPaintedAfterDecode(img: HTMLImageElement | null, mark: () => void): void {
  if (!img || !img.complete || img.naturalWidth === 0) return
  const finish = () => mark()
  if (typeof img.decode === "function") {
    void img.decode().then(finish).catch(finish)
    return
  }
  finish()
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
 * Listing gallery photo. A cached tile/PDP URL is the canvas. Bitmaps stay
 * invisible until decoded, the preview stays under the sharp image, and the
 * wave only covers a well that has no photo URL yet.
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
  const [trackedPreview, setTrackedPreview] = useState(previewSrc ?? "")
  const [previewReady, setPreviewReady] = useState(false)
  const [srcReady, setSrcReady] = useState(false)

  if (src !== trackedSrc) {
    setTrackedSrc(src)
    setSrcReady(false)
  }
  if ((previewSrc ?? "") !== trackedPreview) {
    setTrackedPreview(previewSrc ?? "")
    setPreviewReady(false)
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
          onDragStart={preventNativeListingImageDrag}
          aria-hidden
          className={cn(
            PHOTO_LAYER,
            "pointer-events-none z-[1]",
            className,
            previewReady ? "opacity-100" : "opacity-0",
          )}
          sizes={sizes}
          loading={priority ? "eager" : loading}
          ref={(img) => markPaintedAfterDecode(img, () => setPreviewReady(true))}
          onLoad={(event) => {
            const img = event.currentTarget
            markPaintedAfterDecode(img, () => {
              setPreviewReady(true)
              rememberSize(img, onLoaded)
            })
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
        onDragStart={preventNativeListingImageDrag}
        className={cn(
          PHOTO_LAYER,
          "pointer-events-auto z-[2]",
          className,
          preview && previewReady ? "transition-opacity duration-200 ease-out" : null,
          srcReady ? "opacity-100" : "opacity-0",
        )}
        sizes={sizes}
        priority={priority}
        fetchPriority={fetchPriority}
        loading={loading}
        ref={(img) => markPaintedAfterDecode(img, () => setSrcReady(true))}
        onLoad={(event) => {
          const img = event.currentTarget
          markPaintedAfterDecode(img, () => {
            setSrcReady(true)
            rememberSize(img, onLoaded)
          })
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
