"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Crop } from "lucide-react"
import { ListingPdpCropEditor } from "@/components/features/listings/listing-pdp-crop-editor"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import {
  listingFilmImageSrcFromRow,
  listingTileImageSrcFromRow,
} from "@/lib/listing-image-display"
import {
  proxiedListingImageSrc,
  withListingMediaPdpVariant,
} from "@/lib/listing-media-proxy-url"
import { cn } from "@/lib/utils"
import {
  LISTING_PDP_CROP_OPEN_EVENT,
  listingPdpCropActorIsOwner,
  listingPdpCropFromImageRow,
  type ListingPdpCrop,
} from "@/lib/utils/listing-pdp-crop"

export type ListingPdpCropIslandImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  pdp_crop_zoom?: number | null
  pdp_crop_x?: number | null
  pdp_crop_y?: number | null
}

type ListingPdpCropIslandProps = {
  images: ListingPdpCropIslandImage[]
  initialIndex?: number
  hidden?: boolean
  onCropsSaved?: (crops: Record<string, ListingPdpCrop | null>) => void
}

export function ListingPdpCropIsland({
  images,
  initialIndex = 0,
  hidden = false,
  onCropsSaved,
}: ListingPdpCropIslandProps) {
  const viewer = useListingViewer()
  const listingId = viewer?.listingId?.trim() ?? ""
  const isOwner = listingPdpCropActorIsOwner(viewer?.userId, viewer?.sellerUserId)
  const [open, setOpen] = useState(false)
  const [savedCrops, setSavedCrops] = useState<Record<string, ListingPdpCrop | null>>({})

  useEffect(() => {
    if (!isOwner) return
    const onOpen = () => setOpen(true)
    window.addEventListener(LISTING_PDP_CROP_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(LISTING_PDP_CROP_OPEN_EVENT, onOpen)
  }, [isOwner])

  const editorImages = useMemo(
    () =>
      images
        .filter((image) => image.id && image.url)
        .map((image) => {
          const proxied = proxiedListingImageSrc(image.url) || image.url
          const hero = proxied === "/placeholder.svg" ? proxied : withListingMediaPdpVariant(proxied)
          return {
            id: image.id,
            src: hero,
            previewSrc:
              listingTileImageSrcFromRow(image) ||
              listingFilmImageSrcFromRow(image) ||
              hero,
            crop: Object.prototype.hasOwnProperty.call(savedCrops, image.id)
              ? savedCrops[image.id]
              : listingPdpCropFromImageRow(image),
          }
        }),
    [images, savedCrops],
  )

  const canEdit = Boolean(listingId && viewer?.ready && isOwner)
  if (!canEdit || editorImages.length === 0) return null

  return (
    <>
      {hidden ? null : (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(true)
          }}
          className={cn(
            "pointer-events-auto absolute bottom-3 left-14 z-[16] inline-flex h-8 items-center gap-1.5 rounded-full bg-background/80 px-2.5 text-[13px] font-medium text-foreground shadow-sm backdrop-blur-md",
            "ring-1 ring-black/[0.06] hover:bg-background dark:ring-white/10",
          )}
        >
          <Crop className="size-3.5 opacity-80" aria-hidden />
          Adjust
        </button>
      )}
      {typeof document !== "undefined"
        ? createPortal(
            <ListingPdpCropEditor
              open={open}
              onOpenChange={setOpen}
              listingId={listingId}
              images={editorImages}
              initialIndex={initialIndex}
              onSaved={(saved) => {
                setSavedCrops((prev) => ({ ...prev, ...saved }))
                onCropsSaved?.(saved)
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}
