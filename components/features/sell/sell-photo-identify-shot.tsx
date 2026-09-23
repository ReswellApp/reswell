"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  SELL_PHOTO_MATCH_SHOT_LABEL,
  type SellPhotoMatchShot,
} from "@/lib/sell-flow/sell-photo-match"

const SHOT_STEP: Record<SellPhotoMatchShot, string> = {
  top: "1",
  bottom: "2",
  dimensions: "3",
}

const SHOT_HINT: Record<SellPhotoMatchShot, string> = {
  top: "Deck, logo facing the camera",
  bottom: "Full bottom of the board",
  dimensions: "Close-up of the size label",
}

export function SellPhotoIdentifyShot({
  shot,
  previewUrl,
  disabled,
  onFile,
}: {
  shot: SellPhotoMatchShot
  previewUrl: string | null
  disabled: boolean
  onFile: (shot: SellPhotoMatchShot, file: File) => void
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const libraryRef = React.useRef<HTMLInputElement>(null)

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) onFile(shot, file)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-2">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {SHOT_STEP[shot]}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{SELL_PHOTO_MATCH_SHOT_LABEL[shot]}</p>
        <p className="truncate text-xs text-muted-foreground">{SHOT_HINT[shot]}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={disabled}
          aria-label={previewUrl ? `Retake ${SHOT_HINT[shot]}` : `Photograph the ${shot}`}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={`Upload the ${shot} photo`}
          onClick={() => libraryRef.current?.click()}
        >
          <ImagePlus aria-hidden />
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onPick}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={onPick}
      />
    </div>
  )
}
