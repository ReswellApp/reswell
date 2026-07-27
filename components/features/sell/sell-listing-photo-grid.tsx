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
import { Heart, RefreshCw, RotateCw, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import { cn } from "@/lib/utils"
import { sellListingThumbLoadedSrcByClientId } from "@/components/features/sell/hooks/use-listing-photo-upload"

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

  const remote =
    image.uploadPhase === "done"
      ? (image.thumbnailUrl?.trim() || image.url?.trim() || "").trim()
      : ""
  const localPreview =
    image.optimizePhase === "done" && image.previewUrl.startsWith("blob:")
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
              <div className="absolute bottom-1 left-1 z-[5] flex items-center gap-1 pointer-events-none">
                {index === 0 ? (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1 rounded">
                    Main
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
  photoDescription = "Add photos, then drag to reorder — the first is your main image.",
}: SellListingPhotoGridProps) {
  const internalSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Press-and-hold so a normal swipe still scrolls the page over the photo grid.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const photoDragSensors = externalSensors ?? internalSensors

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Photos</h3>
      <p className="text-xs text-muted-foreground">{photoDescription}</p>
      <Label className="sr-only">Listing photos</Label>
      <div
        className={cn(
          "relative rounded-lg transition-shadow",
          photosFileDragActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {photosFileDragActive ? (
          <div
            className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center rounded-lg bg-primary/10"
            aria-hidden
          >
            <p className="rounded-md bg-background/90 px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
              Drop photos to add
            </p>
          </div>
        ) : null}
        <DndContext sensors={photoDragSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <SortableContext items={images.map((im) => im.clientId)} strategy={rectSortingStrategy}>
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
            {images.length < maxPhotos ? (
              <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-slate-400/80 transition-colors hover:border-primary/50">
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  aria-hidden
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="mt-1 text-xs text-muted-foreground">Add</span>
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
            ) : null}
          </div>
        </DndContext>
      </div>
      <p className="space-y-1 text-xs text-muted-foreground">
        <span className="block">Thank you for listing on Reswell.</span>
        <span className="inline-flex flex-wrap items-center gap-1">
          <span>Made with</span>
          <Heart className="h-4 w-4 shrink-0 fill-listingHeart text-listingHeart" aria-hidden />
          <span>in Santa Barbara.</span>
        </span>
      </p>
    </div>
  )
}
