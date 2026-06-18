"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Move } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  applyBannerFocalDrag,
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
  type ProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { cn } from "@/lib/utils"

type ProfileBannerCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bannerUrl: string
  initialFocalX?: number | null
  initialFocalY?: number | null
  onSaved?: (focal: ProfileBannerFocal) => void
  copy?: {
    title: string
    description: string
    hint: string
    cancel: string
    save: string
    saving: string
  }
}

const DEFAULT_COPY = {
  title: "Edit banner",
  description: "Drag the image to choose what shows in your banner.",
  hint: "Drag to reposition",
  cancel: "Cancel",
  save: "Save crop",
  saving: "Saving…",
}

export function ProfileBannerCropDialog({
  open,
  onOpenChange,
  bannerUrl,
  initialFocalX,
  initialFocalY,
  onSaved,
  copy = DEFAULT_COPY,
}: ProfileBannerCropDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragOriginRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focal: ProfileBannerFocal
  } | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [focal, setFocal] = useState<ProfileBannerFocal>(() =>
    resolveProfileBannerFocal(initialFocalX, initialFocalY),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFocal(resolveProfileBannerFocal(initialFocalX, initialFocalY))
    setNaturalSize(null)
  }, [open, initialFocalX, initialFocalY, bannerUrl])

  const src = profileMediaDisplaySrc(bannerUrl)
  const objectPosition = profileBannerObjectPosition(focal)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!naturalSize) return
    event.preventDefault()
    dragOriginRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      focal,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragOriginRef.current
    const container = containerRef.current
    if (!drag || drag.pointerId !== event.pointerId || !naturalSize || !container) return

    const rect = container.getBoundingClientRect()
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    setFocal(
      applyBannerFocalDrag({
        focal: drag.focal,
        deltaX,
        deltaY,
        containerWidth: rect.width,
        containerHeight: rect.height,
        imageWidth: naturalSize.width,
        imageHeight: naturalSize.height,
      }),
    )
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragOriginRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragOriginRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ focalX: focal.x, focalY: focal.y }),
      })

      const json = (await res.json()) as {
        data?: { focalX: number; focalY: number }
        error?: string
      }

      if (!res.ok) {
        throw new Error(json.error || "Failed to save crop")
      }

      const saved = resolveProfileBannerFocal(json.data?.focalX, json.data?.focalY)
      onSaved?.(saved)
      onOpenChange(false)
      toast.success("Banner crop saved")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save crop"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-5 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div
            ref={containerRef}
            className={cn(
              "relative aspect-[4/1] w-full overflow-hidden rounded-xl bg-neutral-900 touch-none",
              naturalSize ? "cursor-grab active:cursor-grabbing" : "cursor-wait",
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="pointer-events-none select-none object-cover"
              style={{ objectPosition }}
              unoptimized={listingImageShouldBypassOptimization(src)}
              draggable={false}
              onLoadingComplete={({ naturalWidth, naturalHeight }) => {
                if (naturalWidth <= 0 || naturalHeight <= 0) return
                setNaturalSize({ width: naturalWidth, height: naturalHeight })
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-xs font-medium text-white">
              <Move className="h-3.5 w-3.5" aria-hidden />
              {copy.hint}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving || !naturalSize}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {copy.saving}
              </>
            ) : (
              copy.save
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
