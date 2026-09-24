"use client"

import * as React from "react"
import { Camera, ImagePlus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LISTING_IMAGE_MAX_ORIGINAL_BYTES } from "@/lib/listing-image-pipeline"
import { prepareSellPhotoMatchFile } from "@/lib/sell-flow/prepare-sell-photo-match-file"
import type { SellBoardDimensionsScanFields } from "@/lib/sell-flow/sell-board-dimensions-scan"
import { cn } from "@/lib/utils"

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
}

function filledSummary(fields: SellBoardDimensionsScanFields): string {
  const geometry = [
    fields.boardLength,
    fields.boardWidthInches ? `${fields.boardWidthInches}"` : "",
    fields.boardThicknessInches ? `${fields.boardThicknessInches}"` : "",
  ].filter(Boolean)
  const volume = fields.boardVolumeL ? `${fields.boardVolumeL} L` : ""
  return [geometry.join(" × "), volume].filter(Boolean).join(" · ")
}

export function SellBoardDimensionsScan({
  disabled = false,
  onScanned,
  onNeedSignIn,
}: {
  disabled?: boolean
  onScanned: (fields: SellBoardDimensionsScanFields) => void
  onNeedSignIn: () => void
}) {
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const libraryRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [filled, setFilled] = React.useState<SellBoardDimensionsScanFields | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file || busy || disabled) return
    setError(null)
    setFilled(null)
    if (!isImageFile(file)) {
      setError("Choose a photo of the dimensions stamp.")
      return
    }
    if (file.size > LISTING_IMAGE_MAX_ORIGINAL_BYTES) {
      setError("That photo is too large. Try a closer crop.")
      return
    }

    setBusy(true)
    try {
      const prepared = await prepareSellPhotoMatchFile(file)
      const body = new FormData()
      body.set("photo", prepared)
      const res = await fetch("/api/sell/board-dimensions-scan", {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      })
      const payload = (await res.json()) as {
        data?: SellBoardDimensionsScanFields
        error?: string
      }
      if (res.status === 401) {
        onNeedSignIn()
        setError("Sign in to scan dimensions.")
        return
      }
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Could not read that photo. Please try again.")
      }
      onScanned(payload.data)
      setFilled(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that photo. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    void onFile(file)
  }

  const status = busy
    ? "Reading the dimensions stamp…"
    : error
      ? error
      : filled
        ? `Filled ${filledSummary(filled)}. ${filled.formatLabel}.`
        : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
          {busy ? "Reading dimensions…" : "Scan dimensions"}
        </Button>
        <button
          type="button"
          disabled={disabled || busy}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => libraryRef.current?.click()}
        >
          <ImagePlus className="mr-1 inline size-3.5" aria-hidden />
          Choose a photo
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Photograph the size stamp on the stringer or tail. We’ll fill length, width, thickness, and volume.
      </p>
      <p
        className={cn("min-h-5 text-xs", error && !busy ? "text-destructive" : "text-muted-foreground")}
        aria-live="polite"
      >
        {status}
      </p>
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
