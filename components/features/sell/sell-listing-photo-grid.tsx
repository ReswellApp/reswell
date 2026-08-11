"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CheckCircle2, Film, Loader2, Plus, RefreshCw, RotateCw, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LISTING_VIDEO_ACCEPT } from "@/lib/listing-video-pipeline"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import type { ListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"
import { SellListingVideoRecorderDialog } from "@/components/features/sell/sell-listing-video-recorder-dialog"
import { SELL_COMPLETE_BADGE_CLASS } from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"
import { sellListingThumbLoadedSrcByClientId } from "@/components/features/sell/hooks/use-listing-photo-upload"

export type SellListingPhotoGridVideoProps = {
  video: ListingVideoSlot | null
  videoFileInputId: string
  onVideoInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVideoRemove: () => void
  onVideoRetry: () => void
}

export type SellListingPhotoGridProps = {
  images: ListingPhotoSlot[]
  maxPhotos: number
  fileInputId: string
  photosFileDragActive: boolean
  onImageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDragEnter: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onRemove: (clientId: string) => void
  onRetry: (clientId: string) => void
  onRotate180: (clientId: string) => void
  /** When omitted, grid creates its own dnd sensors (same as surfboard sell flow). */
  photoDragSensors?: ReturnType<typeof useSensors>
  photoDescription?: string
  /** Concrete shot suggestions shown as chips in the empty state (e.g. "Deck", "Bottom", "Any dings"). */
  photoTips?: readonly string[]
  /** Rendered between the Photos header and the upload grid (e.g. tips link). */
  aboveGrid?: React.ReactNode
  /** Rendered under the upload grid (e.g. photo examples). */
  belowGrid?: React.ReactNode
  /** When the parent already owns the section title / required copy. */
  hideHeader?: boolean
  /** Minimum photos for the “ready” state. Defaults to 1. */
  minPhotos?: number
  /** Optional listing video — rendered as a non-sortable tile in the filled grid. */
  video?: ListingVideoSlot | null
  videoFileInputId?: string
  onVideoInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onVideoRemove?: () => void
  onVideoRetry?: () => void
}

const SellListingPhotoSortableTile = React.memo(function SellListingPhotoSortableTile({
  image,
  index,
  onRemove,
  onRetry,
  onRotate180,
}: {
  image: ListingPhotoSlot
  index: number
  onRemove: (clientId: string) => void
  onRetry: (clientId: string) => void
  onRotate180: (clientId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: image.clientId,
    transition: null,
  })

  return (
    <SellListingPhotoTile
      image={image}
      index={index}
      onRemove={() => onRemove(image.clientId)}
      onRetry={() => onRetry(image.clientId)}
      onRotate180={() => onRotate180(image.clientId)}
      sortable={{
        setNodeRef,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
        },
        attributes,
        listeners,
        isDragging,
      }}
    />
  )
})

function SellListingPhotoTile({
  image,
  index,
  onRemove,
  onRetry,
  onRotate180,
  sortable,
}: {
  image: ListingPhotoSlot
  index: number
  onRemove: () => void
  onRetry: () => void
  onRotate180: () => void
  sortable: {
    setNodeRef: (node: HTMLElement | null) => void
    style: React.CSSProperties
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners | undefined
    isDragging: boolean
  }
}) {
  const isFailure = image.optimizePhase === "error" || image.uploadPhase === "error"
  const isPendingAuth = image.uploadPhase === "pending_auth"

  const remote =
    image.uploadPhase === "done"
      ? (image.thumbnailUrl?.trim() || image.url?.trim() || "").trim()
      : ""
  const localPreview =
    (image.optimizePhase === "done" || isPendingAuth) &&
    image.previewUrl.startsWith("blob:")
      ? image.previewUrl
      : ""
  const thumbSrc = remote ? (proxiedListingImageSrc(remote) ?? remote) : localPreview
  const photoReady = Boolean(thumbSrc)

  const persistedThumbMatches =
    thumbSrc !== "" &&
    sellListingThumbLoadedSrcByClientId.get(image.clientId) === thumbSrc

  const [thumbLoaded, setThumbLoaded] = useState(persistedThumbMatches)

  useEffect(() => {
    const matched =
      thumbSrc !== "" &&
      sellListingThumbLoadedSrcByClientId.get(image.clientId) === thumbSrc
    setThumbLoaded(matched)
  }, [image.clientId, thumbSrc])

  const skeletonVisible =
    !isFailure &&
    (image.optimizePhase === "running" ||
      image.uploadPhase === "uploading" ||
      (Boolean(thumbSrc) && !thumbLoaded))

  const canRotate180 =
    !isFailure &&
    (Boolean(image.sourceFile) ||
      (image.uploadPhase === "done" && Boolean((image.url ?? "").trim())))

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        ...sortable.style,
        // Inline touchAction — Tailwind utilities are unreliable with dnd-kit on iOS.
        touchAction: sortable.isDragging ? "none" : "pan-y",
      }}
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg border border-transparent bg-muted flex flex-col select-none",
        sortable.isDragging && "z-[60] opacity-70 shadow-lg ring-2 ring-primary/40 scale-[1.02]",
        !isFailure && !skeletonVisible && "cursor-grab active:cursor-grabbing",
      )}
      aria-busy={!isFailure && (!photoReady || !thumbLoaded) ? true : undefined}
      aria-live="polite"
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <div className="relative flex-1 min-h-0">
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt={`Photo ${index + 1}`}
            fill
            draggable={false}
            className={cn(
              "pointer-events-none object-cover object-center transition-opacity duration-500 ease-out motion-reduce:duration-150 [-webkit-touch-callout:none]",
              thumbLoaded ? "opacity-100" : "opacity-0",
            )}
            unoptimized
            onLoadingComplete={() => {
              sellListingThumbLoadedSrcByClientId.set(image.clientId, thumbSrc)
              setThumbLoaded(true)
            }}
          />
        ) : null}
        {!isFailure ? (
          <div
            className={cn(
              "skeleton pointer-events-none absolute inset-0 z-[1] rounded-lg motion-reduce:[animation-duration:1ms]",
              skeletonVisible
                ? "opacity-100"
                : "opacity-0 transition-opacity duration-500 ease-out motion-reduce:duration-150 motion-reduce:transition-none",
            )}
            aria-hidden
          />
        ) : null}
        {!isFailure ? (
          <>
            <div
              className={cn(
                "absolute inset-x-1 top-1 z-[5] flex gap-1 pointer-events-none",
                canRotate180 ? "justify-between" : "justify-end",
              )}
            >
              {canRotate180 ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onRotate180}
                  className={cn(
                    "pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full touch-manipulation hover:bg-background sm:h-9 sm:w-9",
                    skeletonVisible
                      ? "bg-background/90 shadow-sm ring-1 ring-black/5"
                      : "bg-background/80",
                  )}
                  aria-label={`Rotate photo ${index + 1} 180 degrees`}
                  title="Rotate 180°"
                >
                  <RotateCw className="h-3.5 w-3.5 sm:h-3 sm:w-3" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRemove}
                className={cn(
                  "pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full touch-manipulation hover:bg-background sm:h-9 sm:w-9",
                  skeletonVisible
                    ? "bg-background/90 shadow-sm ring-1 ring-black/5"
                    : "bg-background/80",
                )}
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
              </button>
            </div>
            {skeletonVisible ? (
              <span className="sr-only">
                {photoReady ? "Loading thumbnail preview" : "Processing photo"}
              </span>
            ) : (
              <div className="absolute bottom-1 left-1 z-[5] flex flex-wrap items-center gap-1 pointer-events-none">
                {index === 0 ? (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                    Main
                  </span>
                ) : null}
                {isPendingAuth ? (
                  <span className="text-[10px] bg-background/90 px-1 rounded text-foreground ring-1 ring-border">
                    Ready to publish
                  </span>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </div>
      {isFailure ? (
        <div className="shrink-0 space-y-1 border-t border-destructive/20 bg-destructive/10 p-1">
          <p className="line-clamp-2 text-[9px] text-destructive">
            {image.errorMessage || "Couldn't add photo"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 w-full px-1 text-[10px]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRetry}
          >
            <RefreshCw className="mr-0.5 h-3 w-3" />
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function isImageLikeVideoPreview(url: string): boolean {
  const lower = url.toLowerCase()
  return !lower.endsWith(".mp4") && !lower.endsWith(".mov") && !lower.endsWith(".webm")
}

/** Compact dashed tile to pick one optional listing video (shared with accessory grids). */
export function SellListingVideoAddTile({
  fileInputId,
  onInputChange,
}: {
  fileInputId: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-slate-400/80 bg-slate-50/60 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
        <button
          type="button"
          className="absolute inset-0 flex flex-col items-center justify-center px-2 touch-manipulation"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPickerOpen(true)}
          aria-label="Add listing video"
        >
          <Film className="h-6 w-6 text-muted-foreground" strokeWidth={2} aria-hidden />
          <span className="mt-1 text-xs font-medium text-foreground/80">Video</span>
        </button>
        <input
          id={fileInputId}
          type="file"
          accept={LISTING_VIDEO_ACCEPT}
          onChange={onInputChange}
          aria-hidden
          tabIndex={-1}
          className="sr-only"
        />
      </div>
      <SellListingVideoRecorderDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        fileInputId={fileInputId}
      />
    </>
  )
}

/** Filled non-sortable video tile for the photos grid (shared with accessory grids). */
export function SellListingVideoFilledTile({
  video,
  fileInputId,
  onInputChange,
  onRemove,
  onRetry,
}: {
  video: ListingVideoSlot
  fileInputId: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  onRetry: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const preview = video.thumbnailUrl || video.previewUrl
  const uploading = video.status === "uploading"
  const errored = video.status === "error"
  const canReplace =
    video.status === "ready" || errored || video.status === "pending_auth"

  return (
    <>
      <div
        className="relative aspect-square overflow-hidden rounded-lg border border-transparent bg-muted flex flex-col select-none"
        aria-busy={uploading ? true : undefined}
        aria-live="polite"
      >
        <input
          id={fileInputId}
          type="file"
          accept={LISTING_VIDEO_ACCEPT}
          className="sr-only"
          onChange={onInputChange}
          tabIndex={-1}
          aria-hidden
        />
        <div className="relative flex-1 min-h-0 bg-black/90">
          {preview && isImageLikeVideoPreview(preview) ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob / storage poster
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : video.previewUrl || video.url ? (
            <video
              src={video.url ?? video.previewUrl ?? undefined}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 bg-black/50 text-white">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-[10px]">Uploading…</span>
            </div>
          ) : null}

          {!errored ? (
            <div className="absolute inset-x-1 top-1 z-[5] flex justify-end gap-1 pointer-events-none">
              {!uploading ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onRemove}
                  className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/80 touch-manipulation hover:bg-background sm:h-9 sm:w-9"
                  aria-label="Remove video"
                >
                  <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          {!errored && !uploading ? (
            <div className="absolute bottom-1 left-1 z-[5] flex flex-wrap items-center gap-1 pointer-events-none">
              <span className="text-[10px] bg-background/90 px-1 rounded text-foreground ring-1 ring-border">
                Video
              </span>
              {video.status === "pending_auth" ? (
                <span className="text-[10px] bg-background/90 px-1 rounded text-foreground ring-1 ring-border">
                  Sign in to finish
                </span>
              ) : null}
              {canReplace ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setPickerOpen(true)}
                  className="pointer-events-auto cursor-pointer text-[10px] bg-background/90 px-1 rounded text-foreground ring-1 ring-border hover:bg-background"
                >
                  Replace
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {errored ? (
          <div className="shrink-0 space-y-1 border-t border-destructive/20 bg-destructive/10 p-1">
            <p className="line-clamp-2 text-[9px] text-destructive">
              {video.errorMessage || "Couldn't add video"}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 flex-1 px-1 text-[10px]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRetry}
              >
                <RefreshCw className="mr-0.5 h-3 w-3" />
                Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-1 text-[10px]"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRemove}
                aria-label="Remove video"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <SellListingVideoRecorderDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        fileInputId={fileInputId}
      />
    </>
  )
}

function SellListingPhotoGridVideoTile({
  video,
  videoFileInputId,
  onVideoInputChange,
  onVideoRemove,
  onVideoRetry,
}: SellListingPhotoGridVideoProps) {
  if (!video) {
    return (
      <SellListingVideoAddTile
        fileInputId={videoFileInputId}
        onInputChange={onVideoInputChange}
      />
    )
  }
  return (
    <SellListingVideoFilledTile
      video={video}
      fileInputId={videoFileInputId}
      onInputChange={onVideoInputChange}
      onRemove={onVideoRemove}
      onRetry={onVideoRetry}
    />
  )
}

function SellListingPhotoAddTile({
  fileInputId,
  onImageInputChange,
  compact,
  photoTips,
}: {
  fileInputId: string
  onImageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  compact?: boolean
  photoTips?: readonly string[]
}) {
  if (compact) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-slate-400/80 bg-slate-50/60 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]">
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2"
          aria-hidden
        >
          <Plus className="h-6 w-6 text-muted-foreground" strokeWidth={2} />
          <span className="mt-1 text-xs font-medium text-foreground/80">Add</span>
        </div>
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          multiple
          onChange={onImageInputChange}
          aria-label="Add listing photos"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-manipulation"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    )
  }

  return (
    <>
      {/* Mobile: Reverb-style full-width dashed upload button */}
      <div className="relative sm:hidden">
        <div
          className={cn(
            "flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/35 bg-muted/50 px-4 transition-colors",
            "hover:border-foreground/50 hover:bg-muted/70",
          )}
          aria-hidden
        >
          <Plus className="h-5 w-5 text-foreground" strokeWidth={2.25} />
          <span className="text-[15px] font-medium text-foreground">Upload Photo</span>
        </div>
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          multiple
          onChange={onImageInputChange}
          aria-label="Upload photo"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-manipulation"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Desktop / tablet: larger drop zone */}
      <div
        className={cn(
          "relative hidden min-h-[15rem] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-400/80 bg-slate-50/80 px-6 py-10 text-center transition-colors sm:flex sm:min-h-[16rem]",
          "hover:border-primary/50 hover:bg-primary/[0.03]",
        )}
      >
        <div className="pointer-events-none flex flex-col items-center gap-3.5" aria-hidden>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-slate-900/5">
            <Upload className="h-7 w-7 text-foreground/70" strokeWidth={1.75} />
          </span>
          <div className="space-y-1.5">
            <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Add photos of your item
            </p>
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Drag and drop or click to browse. The first photo becomes your cover image.
            </p>
          </div>
          {photoTips && photoTips.length > 0 ? (
            <div className="flex max-w-sm flex-wrap items-center justify-center gap-1.5 pt-1">
              {photoTips.map((tip) => (
                <span
                  key={tip}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-slate-200/80"
                >
                  {tip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <input
          id={`${fileInputId}-desktop`}
          type="file"
          accept="image/*"
          multiple
          onChange={onImageInputChange}
          aria-label="Add listing photos"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-manipulation"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    </>
  )
}

export function SellListingPhotoGrid({
  images,
  maxPhotos,
  fileInputId,
  photosFileDragActive,
  onImageInputChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  onRetry,
  onRotate180,
  photoDragSensors: externalSensors,
  photoDescription,
  photoTips,
  aboveGrid,
  belowGrid,
  hideHeader = false,
  minPhotos = 1,
  video = null,
  videoFileInputId,
  onVideoInputChange,
  onVideoRemove,
  onVideoRetry,
}: SellListingPhotoGridProps) {
  const internalSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Press-and-hold so a normal swipe still scrolls the page over the photo grid.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const photoDragSensors = externalSensors ?? internalSensors
  const isEmpty = images.length === 0
  const photosReady = images.length >= minPhotos
  const photoCountLabel =
    images.length === 1 ? "1 photo" : `${images.length} photos`
  const videoEnabled = Boolean(
    videoFileInputId && onVideoInputChange && onVideoRemove && onVideoRetry,
  )
  const resolvedPhotoDescription =
    photoDescription ??
    (videoEnabled
      ? "Add photos, then drag to reorder — the first is your main image. Optional: add one short video."
      : "Add photos, then drag to reorder — the first is your main image.")
  const videoTile =
    videoEnabled && videoFileInputId && onVideoInputChange && onVideoRemove && onVideoRetry ? (
      <SellListingPhotoGridVideoTile
        video={video}
        videoFileInputId={videoFileInputId}
        onVideoInputChange={onVideoInputChange}
        onVideoRemove={onVideoRemove}
        onVideoRetry={onVideoRetry}
      />
    ) : null

  return (
    <div className="space-y-5">
      {!hideHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {videoEnabled ? "Photos & video" : "Photos"}{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </h3>
            <p className="text-xs text-muted-foreground sm:text-sm">{resolvedPhotoDescription}</p>
          </div>
          <div className="shrink-0 pt-0.5" aria-live="polite">
            {photosReady ? (
              <span className={SELL_COMPLETE_BADGE_CLASS}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                {photoCountLabel} · Ready
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-slate-200/80">
                Add at least {minPhotos}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {aboveGrid}

      <Label className="sr-only">Listing photos</Label>
      <div
        className={cn(
          "relative rounded-xl transition-shadow",
          photosFileDragActive && "ring-2 ring-primary ring-offset-2 ring-offset-slate-100",
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {photosFileDragActive ? (
          <div
            className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center rounded-xl bg-primary/10"
            aria-hidden
          >
            <p className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
              Drop photos to add
            </p>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="space-y-3">
            <SellListingPhotoAddTile
              fileInputId={fileInputId}
              onImageInputChange={onImageInputChange}
              photoTips={photoTips}
            />
            {/* Existing draft video with no photos yet — keep it visible. */}
            {video && videoTile ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {videoTile}
              </div>
            ) : null}
          </div>
        ) : (
          <DndContext
            sensors={photoDragSensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <SortableContext
                items={images.map((im) => im.clientId)}
                strategy={rectSortingStrategy}
              >
                {images.map((image, index) => (
                  <SellListingPhotoSortableTile
                    key={image.clientId}
                    image={image}
                    index={index}
                    onRemove={onRemove}
                    onRetry={onRetry}
                    onRotate180={onRotate180}
                  />
                ))}
              </SortableContext>
              {videoTile}
              {images.length < maxPhotos ? (
                <SellListingPhotoAddTile
                  fileInputId={fileInputId}
                  onImageInputChange={onImageInputChange}
                  compact
                />
              ) : null}
            </div>
          </DndContext>
        )}
      </div>

      {belowGrid}

      {hideHeader && photosReady ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {photoCountLabel} ready — drag to reorder; first is cover.
          {videoEnabled ? " Optional video sits beside your photos." : null}
        </p>
      ) : null}
    </div>
  )
}
