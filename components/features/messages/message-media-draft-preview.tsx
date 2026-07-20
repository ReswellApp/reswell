"use client"

import { Loader2, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MessageMediaDraftPhase = "preparing" | "uploading" | "sending" | "error"

export type MessageMediaDraft = {
  id: string
  kind: "image" | "video"
  previewUrl: string
  fileName: string
  phase: MessageMediaDraftPhase
  /** 0–100 overall progress while preparing/uploading. */
  progress: number
  errorMessage?: string
}

export function MessageMediaDraftPreview({
  draft,
  onCancel,
  onRetry,
  className,
}: {
  draft: MessageMediaDraft
  onCancel: () => void
  onRetry: () => void
  className?: string
}) {
  const busy = draft.phase !== "error"
  const statusLabel =
    draft.phase === "preparing"
      ? "Preparing…"
      : draft.phase === "uploading"
        ? `Uploading ${Math.max(0, Math.min(100, Math.round(draft.progress)))}%`
        : draft.phase === "sending"
          ? "Sending…"
          : draft.errorMessage || "Couldn't send"

  return (
    <div
      className={cn(
        "flex w-full items-stretch gap-2 rounded-[18px] border border-border/60 bg-muted/40 p-2",
        className,
      )}
    >
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[14px] bg-muted">
        {draft.kind === "video" ? (
          <video
            src={draft.previewUrl}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            aria-hidden
          />
        ) : (
          // Local blob preview — next/image is unnecessary here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {busy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 px-1">
            <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
            {draft.phase === "uploading" ? (
              <span className="text-[10px] font-semibold tabular-nums text-white">
                {Math.max(0, Math.min(100, Math.round(draft.progress)))}%
              </span>
            ) : null}
          </div>
        ) : null}
        {draft.phase === "uploading" ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <div
              className="h-full bg-white transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, draft.progress))}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <p className="truncate text-[13px] font-medium text-foreground">{draft.fileName}</p>
        <p
          className={cn(
            "text-[12px] leading-snug",
            draft.phase === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {statusLabel}
        </p>
        {draft.phase === "error" ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 rounded-full px-2.5 text-[12px]"
              onClick={onRetry}
            >
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
              Retry
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-[12px] text-muted-foreground"
              onClick={onCancel}
            >
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {busy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 self-start rounded-full text-muted-foreground"
          aria-label="Cancel upload"
          onClick={onCancel}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
