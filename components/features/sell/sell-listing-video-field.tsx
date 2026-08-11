"use client"

import { Film, Loader2, Trash2, Upload } from "lucide-react"
import { LISTING_VIDEO_ACCEPT } from "@/lib/listing-video-pipeline"
import type { ListingVideoSlot } from "@/lib/sell-flow/listing-video-slot"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type SellListingVideoFieldProps = {
  video: ListingVideoSlot | null
  fileInputId: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  onRetry: () => void
  className?: string
}

export function SellListingVideoField({
  video,
  fileInputId,
  onInputChange,
  onRemove,
  onRetry,
  className,
}: SellListingVideoFieldProps) {
  const preview = video?.thumbnailUrl || video?.previewUrl
  const uploading = video?.status === "uploading"
  const errored = video?.status === "error"

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Video (optional)</p>
          <p className="text-xs text-muted-foreground">
            One clip, 6 seconds–2 minutes, MP4/MOV up to 200MB. Used on your listing and in ads.
          </p>
        </div>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept={LISTING_VIDEO_ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      {!video ? (
        <label
          htmlFor={fileInputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:bg-muted/50"
        >
          <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-foreground">Add a video</span>
          <span className="text-xs text-muted-foreground">Show the board, fit, or product in use</span>
        </label>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
          <div className="relative aspect-video w-full bg-black/90">
            {preview && !preview.endsWith(".mp4") && !preview.endsWith(".mov") && !preview.endsWith(".webm") ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob / storage poster
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : video.previewUrl || video.url ? (
              <video
                src={video.url ?? video.previewUrl ?? undefined}
                className="h-full w-full object-contain"
                muted
                playsInline
                preload="metadata"
                controls={video.status === "ready"}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Film className="h-8 w-8 text-muted-foreground" aria-hidden />
              </div>
            )}

            {uploading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                <span className="text-xs">Uploading video…</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {errored
                ? video.errorMessage || "Upload failed"
                : uploading
                  ? "Uploading…"
                  : video.status === "pending_auth"
                    ? "Sign in to finish uploading"
                    : "Video ready"}
            </p>
            <div className="flex items-center gap-1">
              {errored ? (
                <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
              {!uploading ? (
                <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Remove video</span>
                </Button>
              ) : null}
              {video.status === "ready" || errored || video.status === "pending_auth" ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <label htmlFor={fileInputId} className="cursor-pointer">
                    Replace
                  </label>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
