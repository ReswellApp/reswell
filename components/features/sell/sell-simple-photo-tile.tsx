"use client"

import { memo } from "react"
import Image from "next/image"
import { Loader2, RotateCw, X } from "lucide-react"
import {
  canRotateSimpleSellPhoto,
  type SimpleSellPhotoSlot,
} from "@/lib/sell-flow/simple-listing-photo-rotate"

interface SellSimplePhotoTileProps {
  photo: SimpleSellPhotoSlot
  index: number
  onRotate180: (clientId: string) => void
  onMakePrimary: (clientId: string) => void
  onRemove: (clientId: string) => void
}

export const SellSimplePhotoTile = memo(function SellSimplePhotoTile({
  photo,
  index,
  onRotate180,
  onMakePrimary,
  onRemove,
}: SellSimplePhotoTileProps) {
  const showRotate = canRotateSimpleSellPhoto(photo)

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-transparent bg-muted">
      <Image
        src={photo.previewUrl}
        alt={`Photo ${index + 1}`}
        fill
        sizes="120px"
        className="object-cover object-center"
        unoptimized
      />
      {photo.phase !== "done" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-xs text-muted-foreground">
          {photo.phase === "error" ? (
            <span className="text-destructive">Failed</span>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {photo.progress > 0 ? `${photo.progress}%` : null}
            </>
          )}
        </div>
      ) : null}
      {index === 0 ? (
        <span className="absolute left-1.5 top-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
          Main
        </span>
      ) : null}
      <div className="absolute right-1 top-1 flex gap-1">
        {showRotate ? (
          <button
            type="button"
            onClick={() => onRotate180(photo.clientId)}
            className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
            title="Rotate 180°"
            aria-label={`Rotate photo ${index + 1} 180 degrees`}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {index !== 0 && photo.phase === "done" ? (
          <button
            type="button"
            onClick={() => onMakePrimary(photo.clientId)}
            className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
            title="Make main photo"
            aria-label="Make main photo"
          >
            ★
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(photo.clientId)}
          className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
          title="Remove photo"
          aria-label="Remove photo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})
