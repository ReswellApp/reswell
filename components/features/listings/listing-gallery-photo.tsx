"use client"

import { useEffect, useState, type CSSProperties, type DragEvent } from "react"
import { ListingMediaFillImage } from "@/components/listing-media-fill-image"
import { ListingTileShimmer } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  listingPdpCropCssFit,
  listingPdpCropNeedsPreciseLayout,
  listingPdpCropObjectPosition,
  listingPdpCropToLayout,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

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
  /** /l hero crop only. Thumbnails and tiles omit this. */
  crop?: ListingPdpCrop | null
}

const PHOTO_LAYER =
  "bg-transparent select-none backface-hidden transform-gpu [-webkit-user-drag:none]"

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
  position?: string,
): CSSProperties | undefined {
  if (!src || src === "/placeholder.svg") return undefined
  const safe = src.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return {
    backgroundImage: `url("${safe}")`,
    backgroundSize: fit,
    backgroundPosition: position ?? (fit === "contain" ? "center top" : "center"),
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
  onNatural?: (size: { width: number; height: number }) => void,
): void {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    onNatural?.({ width: img.naturalWidth, height: img.naturalHeight })
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
  crop = null,
}: ListingGalleryPhotoProps) {
  const [trackedSrc, setTrackedSrc] = useState(src)
  const [trackedPreview, setTrackedPreview] = useState(previewSrc ?? "")
  const [previewReady, setPreviewReady] = useState(false)
  const [srcReady, setSrcReady] = useState(false)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null)

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
  const cssFit = listingPdpCropCssFit(crop)
  const objectPosition = crop ? listingPdpCropObjectPosition(crop) : undefined
  const precise = listingPdpCropNeedsPreciseLayout(crop)
  const box =
    precise && crop && natural && frame
      ? listingPdpCropToLayout(frame.width, frame.height, natural.width, natural.height, crop)
      : null

  useEffect(() => {
    if (!precise || !frameEl) return
    const measure = () => {
      const width = frameEl.clientWidth
      const height = frameEl.clientHeight
      if (width <= 0 || height <= 0) return
      setFrame((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frameEl)
    return () => observer.disconnect()
  }, [precise, frameEl])

  const cropClass = box
    ? "inset-auto h-auto w-auto max-w-none object-fill"
    : cssFit === "contain"
      ? "object-contain"
      : "object-cover object-center"
  const cropStyle: CSSProperties | undefined = box
    ? {
        width: box.width,
        height: box.height,
        left: box.left,
        top: box.top,
      }
    : objectPosition && cssFit === "contain"
      ? { objectPosition }
      : objectPosition
        ? { objectPosition }
        : undefined

  function attachFrame(img: HTMLImageElement | null) {
    const parent = img?.parentElement ?? null
    setFrameEl((prev) => (prev === parent ? prev : parent))
  }

  return (
    <>
      {preview ? (
        <ListingMediaFillImage
          key={`preview-${preview}`}
          src={preview}
          alt=""
          draggable={false}
          onDragStart={preventNativeListingImageDrag}
          aria-hidden
          className={cn(
            PHOTO_LAYER,
            cropClass,
            "pointer-events-none z-[1]",
            className,
            previewReady ? "opacity-100" : "opacity-0",
          )}
          style={cropStyle}
          sizes={sizes}
          loading={priority ? "eager" : loading}
          ref={(img) => {
            attachFrame(img)
            markPaintedAfterDecode(img, () => setPreviewReady(true))
          }}
          onLoad={(event) => {
            const img = event.currentTarget
            markPaintedAfterDecode(img, () => {
              setPreviewReady(true)
              rememberSize(img, onLoaded, setNatural)
            })
          }}
        />
      ) : null}
      <ListingMediaFillImage
        key={src}
        src={src}
        alt={alt}
        draggable={false}
        onDragStart={preventNativeListingImageDrag}
        className={cn(
          PHOTO_LAYER,
          cropClass,
          "pointer-events-auto z-[2]",
          className,
          preview && previewReady ? "transition-opacity duration-200 ease-out" : null,
          srcReady ? "opacity-100" : "opacity-0",
        )}
        style={cropStyle}
        sizes={sizes}
        priority={priority}
        fetchPriority={fetchPriority}
        loading={loading}
        ref={(img) => {
          attachFrame(img)
          markPaintedAfterDecode(img, () => setSrcReady(true))
        }}
        onLoad={(event) => {
          const img = event.currentTarget
          markPaintedAfterDecode(img, () => {
            setSrcReady(true)
            rememberSize(img, onLoaded, setNatural)
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
