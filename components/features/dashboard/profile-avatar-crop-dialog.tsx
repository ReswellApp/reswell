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
  objectCoverOverflowPx,
  profileBannerObjectPosition,
  resolveProfileBannerFocal,
  type ProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { cn } from "@/lib/utils"

type ProfileAvatarCropDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  avatarUrl: string
  initialFocalX?: number | null
  initialFocalY?: number | null
  onSaved?: (focal: ProfileBannerFocal) => void
  copy?: {
    title: string
    description: string
    hint: string
    noPanHint: string
    cancel: string
    save: string
    saving: string
  }
}

const DEFAULT_COPY = {
  title: "Edit profile photo",
  description: "Drag the image to choose what shows in your profile photo.",
  hint: "Drag to reposition",
  noPanHint: "Re-upload this photo to enable repositioning.",
  cancel: "Cancel",
  save: "Save crop",
  saving: "Saving…",
}

function readNaturalSize(img: HTMLImageElement): { width: number; height: number } | null {
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return null
  return { width: img.naturalWidth, height: img.naturalHeight }
}

export function ProfileAvatarCropDialog({
  open,
  onOpenChange,
  avatarUrl,
  initialFocalX,
  initialFocalY,
  onSaved,
  copy = DEFAULT_COPY,
}: ProfileAvatarCropDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragOriginRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    focal: ProfileBannerFocal
  } | null>(null)
  const focalRef = useRef<ProfileBannerFocal>(
    resolveProfileBannerFocal(initialFocalX, initialFocalY),
  )
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [focal, setFocal] = useState<ProfileBannerFocal>(() =>
    resolveProfileBannerFocal(initialFocalX, initialFocalY),
  )
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    focalRef.current = focal
  }, [focal])

  useEffect(() => {
    if (!open) return
    const nextFocal = resolveProfileBannerFocal(initialFocalX, initialFocalY)
    setFocal(nextFocal)
    focalRef.current = nextFocal
    setNaturalSize(null)
    dragOriginRef.current = null
    setIsDragging(false)
  }, [open, initialFocalX, initialFocalY, avatarUrl])

  useEffect(() => {
    if (!isDragging) return

    function onPointerMove(event: PointerEvent) {
      const drag = dragOriginRef.current
      const container = containerRef.current
      if (!drag || event.pointerId !== drag.pointerId || !naturalSize || !container) return

      event.preventDefault()
      const rect = container.getBoundingClientRect()
      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY

      const next = applyBannerFocalDrag({
        focal: drag.focal,
        deltaX,
        deltaY,
        containerWidth: rect.width,
        containerHeight: rect.height,
        imageWidth: naturalSize.width,
        imageHeight: naturalSize.height,
      })
      focalRef.current = next
      setFocal(next)
    }

    function endDrag(event: PointerEvent) {
      const drag = dragOriginRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      dragOriginRef.current = null
      setIsDragging(false)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false })
    window.addEventListener("pointerup", endDrag)
    window.addEventListener("pointercancel", endDrag)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", endDrag)
      window.removeEventListener("pointercancel", endDrag)
    }
  }, [isDragging, naturalSize])

  const src = profileMediaDisplaySrc(avatarUrl)
  const objectPosition = profileBannerObjectPosition(focal)
  const [canPan, setCanPan] = useState(false)

  useEffect(() => {
    if (!naturalSize || !containerRef.current) {
      setCanPan(false)
      return
    }

    function measure() {
      const container = containerRef.current
      if (!container || !naturalSize) {
        setCanPan(false)
        return
      }
      const rect = container.getBoundingClientRect()
      const { overflowX, overflowY } = objectCoverOverflowPx({
        containerWidth: rect.width,
        containerHeight: rect.height,
        imageWidth: naturalSize.width,
        imageHeight: naturalSize.height,
      })
      setCanPan(overflowX > 0 || overflowY > 0)
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [naturalSize, open, avatarUrl])

  function handleImageReady(img: HTMLImageElement) {
    const size = readNaturalSize(img)
    if (size) setNaturalSize(size)
  }

  function onDragSurfacePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!naturalSize) return
    event.preventDefault()
    event.stopPropagation()

    dragOriginRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      focal: focalRef.current,
    }
    setIsDragging(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/avatar", {
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
      toast.success("Profile photo crop saved")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save crop"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div
            ref={containerRef}
            className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-full bg-neutral-900 ring-2 ring-neutral-200"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="280px"
              className="pointer-events-none select-none object-cover"
              style={{ objectPosition }}
              unoptimized={listingImageShouldBypassOptimization(src)}
              draggable={false}
              onLoad={(event) => handleImageReady(event.currentTarget)}
            />
            <div
              className={cn(
                "absolute inset-0 z-10 touch-none",
                naturalSize
                  ? canPan
                    ? isDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-not-allowed"
                  : "cursor-wait",
              )}
              onPointerDown={onDragSurfacePointerDown}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-3 py-2 text-center text-xs font-medium text-white">
              <Move className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{naturalSize && !canPan ? copy.noPanHint : copy.hint}</span>
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
