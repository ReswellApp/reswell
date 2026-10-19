"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Crop } from "lucide-react"
import { toast } from "sonner"
import { ListingPdpCropEditor } from "@/components/features/listings/listing-pdp-crop-editor"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import { browserProfileIsAdmin } from "@/lib/auth/browser-profile-is-admin"
import { createClient } from "@/lib/supabase/client"
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
import {
  LISTING_PHOTO_TONE_IDENTITY,
  isListingPhotoToneIdentity,
  parseListingPhotoToneActiveRecipes,
  type ListingPhotoTone,
  type ListingPhotoToneSavedImage,
} from "@/lib/utils/listing-photo-tone"

export type ListingPdpCropIslandImage = {
  id: string
  url: string
  is_primary: boolean
  thumbnail_url?: string | null
  pdp_crop_zoom?: number | null
  pdp_crop_x?: number | null
  pdp_crop_y?: number | null
}

type LoadedListingPhotoTone = {
  sourceUrl: string
  tone: ListingPhotoTone
}

type ListingPdpCropIslandProps = {
  images: ListingPdpCropIslandImage[]
  initialIndex?: number
  hidden?: boolean
  onCropsSaved?: (crops: Record<string, ListingPdpCrop | null>) => void
  onToneSaved?: (images: ListingPhotoToneSavedImage[]) => void
}

export function ListingPdpCropIsland({
  images,
  initialIndex = 0,
  hidden = false,
  onCropsSaved,
  onToneSaved,
}: ListingPdpCropIslandProps) {
  const router = useRouter()
  const viewer = useListingViewer()
  const listingId = viewer?.listingId?.trim() ?? ""
  const isOwner = listingPdpCropActorIsOwner(viewer?.userId, viewer?.sellerUserId)
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [savedCrops, setSavedCrops] = useState<Record<string, ListingPdpCrop | null>>({})
  const [recipes, setRecipes] = useState<Record<string, LoadedListingPhotoTone>>({})
  const openRequestRef = useRef(0)

  useEffect(() => {
    if (!viewer?.userId) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    void browserProfileIsAdmin(createClient()).then((value) => {
      if (!cancelled) setIsAdmin(value === true)
    })
    return () => {
      cancelled = true
    }
  }, [viewer?.userId])

  const openAdjust = useCallback(async () => {
    const request = openRequestRef.current + 1
    openRequestRef.current = request
    if (isAdmin && listingId) {
      try {
        const res = await fetch(`/api/listings/${listingId}/photo-tone`, {
          credentials: "include",
        })
        if (request !== openRequestRef.current) return
        if (!res.ok) {
          toast.error("Could not load photo adjustments")
        } else {
          const loaded = parseListingPhotoToneActiveRecipes(await res.json())
          if (request !== openRequestRef.current) return
          const next: Record<string, LoadedListingPhotoTone> = {}
          for (const recipe of loaded) {
            next[recipe.id] = { sourceUrl: recipe.sourceUrl, tone: recipe.tone }
          }
          setRecipes(next)
        }
      } catch {
        if (request !== openRequestRef.current) return
        toast.error("Could not load photo adjustments")
      }
    }
    if (request !== openRequestRef.current) return
    setOpen(true)
  }, [isAdmin, listingId])

  useEffect(() => {
    if (!isOwner && !isAdmin) return
    const onOpen = () => {
      void openAdjust()
    }
    window.addEventListener(LISTING_PDP_CROP_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(LISTING_PDP_CROP_OPEN_EVENT, onOpen)
  }, [isAdmin, isOwner, openAdjust])

  const editorImages = useMemo(
    () =>
      images
        .filter((image) => image.id && image.url)
        .map((image) => {
          const recipe = recipes[image.id]
          const proxied = proxiedListingImageSrc(image.url) || image.url
          const hero = proxied === "/placeholder.svg" ? proxied : withListingMediaPdpVariant(proxied)
          const sourceUrl = recipe?.sourceUrl || image.url
          const proxiedSource = proxiedListingImageSrc(sourceUrl) || sourceUrl
          const sourceHero =
            proxiedSource === "/placeholder.svg" ? proxiedSource : withListingMediaPdpVariant(proxiedSource)
          return {
            id: image.id,
            src: hero,
            sourceSrc: sourceHero || hero,
            previewSrc:
              listingTileImageSrcFromRow(image) ||
              listingFilmImageSrcFromRow(image) ||
              hero,
            crop: Object.prototype.hasOwnProperty.call(savedCrops, image.id)
              ? savedCrops[image.id]
              : listingPdpCropFromImageRow(image),
            tone: recipe?.tone ?? { ...LISTING_PHOTO_TONE_IDENTITY },
          }
        }),
    [images, recipes, savedCrops],
  )

  const canEdit = Boolean(listingId && viewer?.ready && (isOwner || isAdmin))
  if (!canEdit || editorImages.length === 0) return null

  return (
    <>
      {hidden ? null : (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            void openAdjust()
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
              canCrop={isOwner}
              canTone={isAdmin}
              onSaved={(saved) => {
                setSavedCrops((prev) => ({ ...prev, ...saved }))
                onCropsSaved?.(saved)
              }}
              onToneSaved={(saved) => {
                setRecipes((prev) => {
                  const next = { ...prev }
                  for (const image of saved) {
                    if (!image.sourceUrl || isListingPhotoToneIdentity(image)) {
                      delete next[image.id]
                      continue
                    }
                    next[image.id] = {
                      sourceUrl: image.sourceUrl,
                      tone: {
                        brightness: image.brightness,
                        highlights: image.highlights,
                        shadows: image.shadows,
                        contrast: image.contrast,
                      },
                    }
                  }
                  return next
                })
                onToneSaved?.(saved)
                router.refresh()
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}
