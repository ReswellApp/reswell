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
import { useListingPhotoReady } from "@/components/features/listings/hooks/use-listing-photo-ready"
import { listingImageIsDecoded } from "@/lib/listing-photo-paint"
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

export { listingPhotoIsCached } from "@/lib/listing-photo-paint"

/**
 * Listing gallery photo. Before paint we ask the mounted image if it already
 * has pixels. A cached tile or PDP photo skips the wave. An uncached bitmap
 * stays under it until decode. The preview stays under the sharp image.
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
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null)
  const onLoadedRef = useRef(onLoaded)
  onLoadedRef.current = onLoaded

  const preview =
    previewSrc && previewSrc !== src && previewSrc !== "/placeholder.svg" ? previewSrc : ""
  const sourcePaint = useListingPhotoReady(src)
  const previewPaint = useListingPhotoReady(preview)
  const srcReady = sourcePaint.ready
  const previewReady = previewPaint.ready
  const painted = srcReady || previewReady
  const cssFit = listingPdpCropCssFit(crop)
  const objectPosition = crop ? listingPdpCropObjectPosition(crop) : undefined
  const precise = listingPdpCropNeedsPreciseLayout(crop)
  // Below cover (zoom < 1) the measured box is smaller than the frame and
  // leaves a gap. Those photos center and scale up to cover instead.
  const box =
    precise && crop && crop.zoom >= 1 && natural && frame
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

  const resolvedFit = crop ? (cssFit === "contain" ? "cover" : cssFit) : objectFit
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
        objectFit: "fill",
        ["--listing-pdp-object-fit" as string]: "fill",
        ["--listing-pdp-object-position" as string]: objectPosition ?? "center center",
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

  const attachPreview = useCallback(
    (img: HTMLImageElement | null) => {
      previewPaint.ref(img)
    },
    [previewPaint.ref],
  )

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
      sourcePaint.ref(img)
      // iOS Chrome / Google app often skip onLoad for cached images.
      if (img && listingImageIsDecoded(img)) rememberNaturalSize(img)
    },
    [attachFrame, rememberNaturalSize, sourcePaint.ref],
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
            previewPaint.onLoad(event.currentTarget)
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
          sourcePaint.onLoad(img)
          if (listingImageIsDecoded(img)) rememberNaturalSize(img)
        }}
      />
      {painted ? null : (
        <ListingTileShimmer
          aria-hidden
          className="absolute inset-0 z-[3] rounded-none"
        />
      )}
    </>
  )
}
