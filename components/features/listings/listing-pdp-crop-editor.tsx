"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useRouter } from "next/navigation"
import { Loader2, Minus, Plus } from "lucide-react"
import { toast } from "sonner"
import { ListingPhotoRotateControls } from "@/components/features/listings/listing-photo-orientation-controls"
import { useListingPdpCropGestures } from "@/components/features/listings/hooks/use-listing-pdp-crop-gestures"
import { Slider } from "@/components/ui/slider"
import { DEFAULT_LISTING_HERO_ASPECT, listingHeroAspectCss } from "@/lib/listing-hero-frame"
import { listingPhotoFillClassName } from "@/lib/listing-photo-fill"
import { cn } from "@/lib/utils"
import {
  LISTING_PDP_CROP_COVER,
  LISTING_PDP_CROP_FIT,
  LISTING_PDP_CROP_MAX_ZOOM,
  isListingPdpCropDefault,
  listingPdpCropToLayout,
  listingPdpCropsEqual,
  listingPdpLayoutToCrop,
  retainMeasuredSize,
  type ListingPdpCrop,
  type ListingPdpCropLayout,
} from "@/lib/utils/listing-pdp-crop"
import type { ListingPhotoQuarterTurns } from "@/lib/sell-flow/listing-photo-orientation"

export type ListingPdpCropEditorImage = {
  id: string
  src: string
  previewSrc?: string
  crop: ListingPdpCrop | null
}

type ListingPdpCropEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  listingId: string
  images: ListingPdpCropEditorImage[]
  initialIndex?: number
  onSaved?: (crops: Record<string, ListingPdpCrop | null>) => void
  onImagesRotated?: (
    images: Array<{
      id: string
      url: string
      thumbnailUrl: string
      crop: ListingPdpCrop | null
    }>,
  ) => void
}

function cropOrDefault(crop: ListingPdpCrop | null): ListingPdpCrop {
  return crop ?? LISTING_PDP_CROP_COVER
}

function rememberNaturalSize(
  img: HTMLImageElement | null,
  setNatural: Dispatch<SetStateAction<{ w: number; h: number } | null>>,
): void {
  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return
  const w = img.naturalWidth
  const h = img.naturalHeight
  // Inline refs run again every render. A new size object here loops until
  // React throws and the listing page becomes the error screen.
  setNatural((prev) => retainMeasuredSize(prev, w, h))
}

export function ListingPdpCropEditor({
  open,
  onOpenChange,
  listingId,
  images,
  initialIndex = 0,
  onSaved,
  onImagesRotated,
}: ListingPdpCropEditorProps) {
  const router = useRouter()
  const frameRef = useRef<HTMLDivElement>(null)
  const photoImgRef = useRef<HTMLImageElement | null>(null)
  const [index, setIndex] = useState(initialIndex)
  const [crops, setCrops] = useState<Record<string, ListingPdpCrop>>({})
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null)
  const [layout, setLayout] = useState<ListingPdpCropLayout | null>(null)
  const [interacting, setInteracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quarterTurns, setQuarterTurns] = useState<Record<string, ListingPhotoQuarterTurns>>({})

  const photo = images[index] ?? images[0] ?? null
  const currentCrop = photo ? cropOrDefault(crops[photo.id] ?? photo.crop) : LISTING_PDP_CROP_COVER
  const currentTurns: ListingPhotoQuarterTurns = photo ? (quarterTurns[photo.id] ?? 0) : 0
  const attachPhotoImage = useCallback((img: HTMLImageElement | null) => {
    photoImgRef.current = img
    // iOS Chrome / Google app often skip onLoad for cached images.
    if (img?.complete) rememberNaturalSize(img, setNatural)
  }, [])

  const initialCrops = useMemo(() => {
    const next: Record<string, ListingPdpCrop | null> = {}
    for (const image of images) next[image.id] = image.crop
    return next
  }, [images])

  useEffect(() => {
    if (!open) return
    const next: Record<string, ListingPdpCrop> = {}
    for (const image of images) next[image.id] = cropOrDefault(image.crop)
    setCrops(next)
    const nextIndex = Math.min(Math.max(0, initialIndex), Math.max(0, images.length - 1))
    setQuarterTurns({})
    setIndex(nextIndex)
    const nextPhoto = images[nextIndex] ?? images[0] ?? null
    const img = photoImgRef.current
    if (
      img &&
      nextPhoto &&
      img.getAttribute("data-photo-id") === nextPhoto.id &&
      img.complete
    ) {
      // New object so the layout effect reapplies after the reset below.
      setNatural(retainMeasuredSize(null, img.naturalWidth, img.naturalHeight))
    } else {
      setNatural(null)
    }
    setLayout(null)
  }, [open, images, initialIndex])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el || !open) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const w = rect.width
      const h = rect.height
      setFrame((prev) =>
        prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [open, photo?.id])

  useLayoutEffect(() => {
    if (!open || !photo || !natural || !frame) return
    setLayout(
      listingPdpCropToLayout(frame.w, frame.h, natural.w, natural.h, currentCrop),
    )
    // Recenter when the photo or measured frame changes — not on every live crop tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crop is applied from layout during gestures
  }, [open, photo?.id, natural, frame])

  function applyLayout(next: ListingPdpCropLayout) {
    if (!photo || !natural || !frame) return
    setLayout(next)
    const crop = listingPdpLayoutToCrop(frame.w, frame.h, natural.w, natural.h, next)
    setCrops((prev) => ({ ...prev, [photo.id]: crop }))
  }

  function applyCrop(crop: ListingPdpCrop) {
    if (!photo) return
    setCrops((prev) => ({ ...prev, [photo.id]: crop }))
    if (natural && frame) {
      setLayout(listingPdpCropToLayout(frame.w, frame.h, natural.w, natural.h, crop))
    }
  }

  const gestures = useListingPdpCropGestures({
    enabled: open && currentTurns === 0 && Boolean(layout && natural && frame),
    frameRef,
    layout,
    frame,
    image: natural,
    onLayout: applyLayout,
    onInteracting: setInteracting,
  })

  async function handleSave() {
    if (!photo) return
    const rotations = images.flatMap((image) => {
      const turns = quarterTurns[image.id] ?? 0
      if (turns === 0) return []
      return [{ id: image.id, quarterTurns: turns }]
    })
    const rotatedIds = new Set(rotations.map((rotation) => rotation.id))
    const changed = images
      .map((image) => {
        if (rotatedIds.has(image.id)) return null
        const next = crops[image.id] ?? cropOrDefault(image.crop)
        const prev = initialCrops[image.id] ?? null
        if (listingPdpCropsEqual(next, prev)) return null
        return { id: image.id, ...next }
      })
      .filter((row): row is { id: string } & ListingPdpCrop => row != null)

    if (rotations.length === 0 && changed.length === 0) {
      onOpenChange(false)
      return
    }

    setSaving(true)
    const rotated: Array<{
      id: string
      url: string
      thumbnailUrl: string
      crop: ListingPdpCrop | null
    }> = []
    const commitRotations = () => {
      if (rotated.length === 0) return
      onImagesRotated?.(rotated)
      router.refresh()
    }
    try {
      if (rotations.length > 0) {
        for (const rotation of rotations) {
          const res = await fetch(
            `/api/listings/${listingId}/images/${rotation.id}/rotate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ quarterTurns: rotation.quarterTurns }),
            },
          )
          const json = (await res.json()) as {
            data?: {
              image?: {
                id: string
                url: string
                thumbnailUrl: string
                crop: ListingPdpCrop | null
              }
            }
            error?: string
          }
          if (!res.ok || !json.data?.image) {
            throw new Error(json.error || "Could not rotate photo")
          }
          rotated.push(json.data.image)
          // Server already rewrote this file. Drop the pending turn so a
          // later failure / retry cannot apply the same rotation again.
          setQuarterTurns((prev) => ({ ...prev, [rotation.id]: 0 }))
        }
        commitRotations()
      }

      if (changed.length > 0) {
        const res = await fetch(`/api/listings/${listingId}/pdp-crop`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ images: changed }),
        })
        const json = (await res.json()) as {
          data?: { images?: Array<{ id: string } & ListingPdpCrop> }
          error?: string
        }
        if (!res.ok) throw new Error(json.error || "Could not save crop")

        const saved: Record<string, ListingPdpCrop | null> = {}
        for (const image of json.data?.images ?? changed) {
          saved[image.id] = isListingPdpCropDefault(image) ? null : image
        }
        onSaved?.(saved)
      }

      onOpenChange(false)
      toast.success(
        rotations.length > 0 && changed.length > 0
          ? "Photos updated"
          : rotations.length > 0
            ? "Photo turned"
            : "Photo crop saved",
      )
    } catch (err: unknown) {
      commitRotations()
      toast.error(err instanceof Error ? err.message : "Could not save photo")
    } finally {
      setSaving(false)
    }
  }

  if (!open || images.length === 0) return null

  const src = photo?.src || photo?.previewSrc || ""
  const zoomPct = Math.round((currentCrop.zoom / LISTING_PDP_CROP_MAX_ZOOM) * 100)

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-pdp-crop-title"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <button
          type="button"
          className="min-h-11 min-w-14 text-left text-[17px] font-normal text-white/90"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </button>
        <h2 id="listing-pdp-crop-title" className="text-[17px] font-semibold tracking-tight">
          Edit photo
        </h2>
        <button
          type="button"
          className="min-h-11 min-w-14 text-right text-[17px] font-semibold text-[#0a84ff] disabled:opacity-50"
          onClick={() => void handleSave()}
          disabled={saving || (currentTurns === 0 && !natural)}
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-3 sm:px-8">
        <div
          ref={frameRef}
          className={cn(
            "relative w-full max-w-[22rem] overflow-hidden rounded-[28px] bg-[#111] shadow-[0_0_0_1px_rgba(255,255,255,0.12)] touch-none select-none sm:max-w-[26rem]",
            currentTurns !== 0
              ? "cursor-default"
              : natural
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-wait",
          )}
          style={{
            aspectRatio: listingHeroAspectCss(DEFAULT_LISTING_HERO_ASPECT),
            width: "min(100%, 22rem, calc(min(58svh, 32rem) * 0.75))",
          }}
          onPointerDown={gestures.onPointerDown}
          onPointerMove={gestures.onPointerMove}
          onPointerUp={gestures.onPointerUp}
          onPointerCancel={gestures.onPointerUp}
        >
          {currentTurns !== 0 && src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ transform: `rotate(${currentTurns * 90}deg)` }}
            />
          ) : null}
          {src && currentTurns === 0 ? (
            <img
              key={photo?.id}
              src={src}
              alt=""
              draggable={false}
              data-photo-id={photo?.id}
              className="absolute max-w-none select-none will-change-transform"
              style={
                layout
                  ? {
                      width: layout.width,
                      height: layout.height,
                      left: layout.left,
                      top: layout.top,
                    }
                  : { inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }
              }
              ref={attachPhotoImage}
              onLoad={(event) => {
                rememberNaturalSize(event.currentTarget, setNatural)
              }}
            />
          ) : null}
          {interacting ? (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="border border-white/25" />
              ))}
            </div>
          ) : null}
          {currentTurns === 0 && !natural ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-white/50" aria-hidden />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-4 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        <ListingPhotoRotateControls
          quarterTurns={currentTurns}
          disabled={saving || !photo}
          onQuarterTurnsChange={(turns) => {
            if (!photo) return
            setQuarterTurns((prev) => ({ ...prev, [photo.id]: turns }))
          }}
        />
        {currentTurns === 0 ? (
        <>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              currentCrop.zoom === 0
                ? "bg-white text-black"
                : "bg-white/12 text-white hover:bg-white/18",
            )}
            onClick={() => applyCrop(LISTING_PDP_CROP_FIT)}
          >
            Fit
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              currentCrop.zoom >= 1 && currentCrop.x === 50 && currentCrop.y === 50
                ? "bg-white text-black"
                : "bg-white/12 text-white hover:bg-white/18",
            )}
            onClick={() => applyCrop(LISTING_PDP_CROP_COVER)}
          >
            Fill
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Zoom out"
            onClick={() =>
              applyCrop({
                ...currentCrop,
                zoom: Math.max(0, Math.round((currentCrop.zoom - 0.15) * 100) / 100),
              })
            }
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <Slider
            min={0}
            max={LISTING_PDP_CROP_MAX_ZOOM}
            step={0.01}
            value={[currentCrop.zoom]}
            onValueChange={([zoom]) => {
              if (typeof zoom !== "number") return
              applyCrop({ ...currentCrop, zoom })
            }}
            className="[&_[role=slider]]:size-6 [&_[role=slider]]:border-0 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/20"
            aria-label="Zoom"
          />
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white"
            aria-label="Zoom in"
            onClick={() =>
              applyCrop({
                ...currentCrop,
                zoom: Math.min(
                  LISTING_PDP_CROP_MAX_ZOOM,
                  Math.round((currentCrop.zoom + 0.15) * 100) / 100,
                ),
              })
            }
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>

        <p className="text-center text-[13px] text-white/55">
          Pinch to zoom · drag to move
          <span className="sr-only"> {zoomPct} percent zoom</span>
        </p>
        </>
        ) : (
          <p className="text-center text-[13px] text-white/55">
            Save the turn, then drag to reframe.
          </p>
        )}

        {images.length > 1 ? (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Edit photo ${i + 1}`}
                onClick={() => {
                  setIndex(i)
                  setNatural(null)
                  setLayout(null)
                }}
                className={cn(
                  "relative size-12 shrink-0 overflow-hidden rounded-xl bg-white/10",
                  i === index ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-70",
                )}
              >
                <img
                  src={image.previewSrc || image.src}
                  alt=""
                  className={listingPhotoFillClassName}
                  style={{ transform: `rotate(${(quarterTurns[image.id] ?? 0) * 90}deg)` }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
