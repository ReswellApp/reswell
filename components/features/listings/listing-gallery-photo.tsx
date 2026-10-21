"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react"
import { ListingMediaFillImage } from "@/components/listing-media-fill-image"
import { listingPhotoFrameFillStyle } from "@/lib/listing-photo-fill"
import { ListingTileShimmer } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  listingPdpCropCssFit,
  listingPdpCropNeedsPreciseLayout,
  listingPdpCropObjectPosition,
  listingPdpCropToLayout,
  retainMeasuredSize,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

export interface ListingGalleryPhotoProps {
  src: string
  /** Browse/tile URL — often already in cache from the feed the user just left. */
  previewSrc?: string
  alt: string
  sizes: string
  className?: string
  /** Listing PDP hero and tiles cover the locked 3:4 frame. Thumbs stay cover. */
  objectFit?: "cover" | "contain"
  priority?: boolean
  fetchPriority?: "high" | "low" | "auto"
  loading?: "eager" | "lazy"
  onLoaded?: (size: { naturalWidth: number; naturalHeight: number }) => void
  /** /l hero crop only. Thumbnails and tiles omit this. */
  crop?: ListingPdpCrop | null
}

const PHOTO_LAYER =
  "bg-transparent select-none object-center backface-hidden transform-gpu [-webkit-user-drag:none]"

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
  objectFit = "cover",
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
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

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
  // Fit is object-fit: contain. Anything between fit and a plain cover, and
  // any zoom past cover, needs the measured box so the hero matches the editor.
  const box =
    precise && crop && natural && frame
      ? listingPdpCropToLayout(frame.width, frame.height, natural.w, natural.h, crop)
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

  const resolvedFit = crop ? cssFit : objectFit
  const fitClass = box
    ? "inset-auto h-auto w-auto max-w-none"
    : resolvedFit === "contain"
      ? "object-contain"
      : "object-cover"
  /**
   * One bitmap, pinned to the frame. Center it, then scale until both edges
   * are covered. A second background-image of the same photo reads as a
   * doubled tail under the board.
   */
  const frameFillStyle: CSSProperties = {
    ...listingPhotoFrameFillStyle,
    objectFit: resolvedFit === "contain" ? "contain" : "cover",
    objectPosition: objectPosition ?? "center center",
  }
  // Seller crops opt out of the listing-hero cover rule via their class.
  const cropStyle: CSSProperties | undefined = box
    ? {
        position: "absolute",
        width: box.width,
        height: box.height,
        left: box.left,
        top: box.top,
        maxWidth: "none",
        objectFit: "contain",
        objectPosition: "center center",
        ["--listing-pdp-object-fit" as string]: "contain",
        ["--listing-pdp-object-position" as string]: "center center",
      }
    : crop
      ? {
          ...frameFillStyle,
          objectFit: resolvedFit === "contain" ? "contain" : "cover",
          objectPosition: objectPosition ?? "center center",
          ["--listing-pdp-object-fit" as string]: resolvedFit === "contain" ? "contain" : "cover",
          ["--listing-pdp-object-position" as string]: objectPosition ?? "center center",
        }
      : frameFillStyle
  const layerClass = cn(PHOTO_LAYER, fitClass, crop && "listing-pdp-seller-crop")

  const attachFrame = useCallback((img: HTMLImageElement | null) => {
    const parent = img?.parentElement ?? null
    setFrameEl((prev) => (prev === parent ? prev : parent))
  }, [])

  const attachPreview = useCallback((img: HTMLImageElement | null) => {
    markPaintedAfterDecode(img, () => setPreviewReady(true))
  }, [])

  const rememberNaturalSize = useCallback((img: HTMLImageElement) => {
    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    setNatural((prev) => retainMeasuredSize(prev, naturalWidth, naturalHeight))
    if (naturalWidth > 0 && naturalHeight > 0) {
      onLoadedRef.current?.({ naturalWidth, naturalHeight })
    }
  }, [])

  const attachSource = useCallback(
    (img: HTMLImageElement | null) => {
      attachFrame(img)
      markPaintedAfterDecode(img, () => {
        setSrcReady(true)
        // iOS Chrome / Google app often skip onLoad for cached images.
        if (img) rememberNaturalSize(img)
      })
    },
    [attachFrame, rememberNaturalSize],
  )

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
            layerClass,
            "pointer-events-none z-[1]",
            className,
            previewReady && !srcReady ? "opacity-100" : "opacity-0",
          )}
          style={cropStyle}
          sizes={sizes}
          loading={priority ? "eager" : loading}
          ref={attachPreview}
          onLoad={(event) => {
            // Preview is paint-only — never size the hero from the tile derivative.
            markPaintedAfterDecode(event.currentTarget, () => setPreviewReady(true))
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
          layerClass,
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
        ref={attachSource}
        onLoad={(event) => {
          const img = event.currentTarget
          markPaintedAfterDecode(img, () => {
            setSrcReady(true)
            rememberNaturalSize(img)
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
