"use client"

import { RotateCcw, RotateCw } from "lucide-react"
import {
  addListingPhotoQuarterTurns,
  type ListingPhotoQuarterTurns,
} from "@/lib/sell-flow/listing-photo-orientation"
import { cn } from "@/lib/utils"

const TURN_LABEL: Record<ListingPhotoQuarterTurns, string> = {
  0: "Automatic",
  1: "90° clockwise",
  2: "180°",
  3: "90° counterclockwise",
}

interface ListingPhotoOrientationPreviewProps {
  src: string
  quarterTurns: ListingPhotoQuarterTurns
  className?: string
}

/** Square stage. The bitmap turns in place so a sideways photo is obvious. */
export function ListingPhotoOrientationPreview({
  src,
  quarterTurns,
  className,
}: ListingPhotoOrientationPreviewProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-2xl bg-black",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="h-full w-full object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `rotate(${quarterTurns * 90}deg)` }}
        />
      ) : null}
    </div>
  )
}

interface ListingPhotoRotateControlsProps {
  quarterTurns: ListingPhotoQuarterTurns
  onQuarterTurnsChange: (quarterTurns: ListingPhotoQuarterTurns) => void
  disabled?: boolean
  className?: string
}

export function ListingPhotoRotateControls({
  quarterTurns,
  onQuarterTurnsChange,
  disabled = false,
  className,
}: ListingPhotoRotateControlsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onQuarterTurnsChange(addListingPhotoQuarterTurns(quarterTurns, -1))}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-[14px] font-medium text-white hover:bg-white/18 disabled:opacity-40"
        >
          <RotateCcw className="size-4" aria-hidden />
          Left
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onQuarterTurnsChange(addListingPhotoQuarterTurns(quarterTurns, 1))}
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[14px] font-medium text-black hover:bg-white/90 disabled:opacity-40"
        >
          <RotateCw className="size-4" aria-hidden />
          Right
        </button>
        {quarterTurns !== 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onQuarterTurnsChange(0)}
            className="inline-flex h-11 items-center rounded-full bg-white/12 px-4 text-[14px] font-medium text-white hover:bg-white/18 disabled:opacity-40"
          >
            Auto
          </button>
        ) : null}
      </div>
      <p className="text-center text-[13px] text-white/60">
        {TURN_LABEL[quarterTurns]}. Camera orientation is applied automatically. Each tap turns 90°.
      </p>
    </div>
  )
}
