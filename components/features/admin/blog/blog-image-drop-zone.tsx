'use client'

import * as React from "react"
import { ImagePlus, Loader2, UploadCloud } from "lucide-react"
import { uploadBlogMediaFile } from "@/lib/blog/upload-blog-media"
import { proxiedBlogImageSrc } from "@/lib/blog/blog-media-proxy-url"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

type Props = {
  /** Field label shown above drop zone */
  label: string
  /** Controlled HTTPS URL after upload */
  value: string
  onUrlChange: (next: string, dimensions?: { width: number; height: number }) => void
  /** Narrower footprint for inline/block editors */
  compact?: boolean
  /** Extra line under the upload constraints (copyright policy, optional cover, etc.) */
  hint?: string
  className?: string
}

/** Drag-and-drop or click-to-upload strip (CMS). */
export function BlogImageDropZone({ label, value, onUrlChange, compact, hint, className }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  async function consumeFile(file: File | undefined | null) {
    if (!file) return
    setUploading(true)
    try {
      const uploaded = await uploadBlogMediaFile(file)
      if (uploaded) onUrlChange(uploaded.url, { width: uploaded.width, height: uploaded.height })
    } finally {
      setUploading(false)
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    void consumeFile(file)
    e.target.value = ""
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type.startsWith("image/"))
    void consumeFile(file ?? e.dataTransfer.files?.[0])
  }

  const trimmedValue = value.trim()
  const previewSrc = trimmedValue ? proxiedBlogImageSrc(trimmedValue) : ""
  const urlLooksLikeImage =
    previewSrc.startsWith("/media/blog/") ||
    (/^https:/i.test(trimmedValue) &&
      /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(trimmedValue))

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-foreground">{label}</Label>

      <button
        type="button"
        aria-label={`Upload image for ${label}`}
        disabled={uploading}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
          dragActive ? "border-primary bg-primary/5" : "border-input",
          compact ? "gap-2 px-3 py-6" : "gap-3 px-4 py-10",
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onPick}
          tabIndex={-1}
          aria-hidden
        />
        {uploading ? (
          <Loader2 className={cn("text-muted-foreground animate-spin", compact ? "h-7 w-7" : "h-10 w-10")} aria-hidden />
        ) : (
          <UploadCloud
            className={cn(
              "text-muted-foreground transition-colors group-hover:text-foreground",
              compact ? "h-8 w-8" : "h-11 w-11",
            )}
            aria-hidden
          />
        )}
        <span className="max-w-[20rem] text-sm font-medium text-foreground">
          {uploading ? "Uploading…" : dragActive ? "Drop image here" : "Drag image here or click to browse"}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          JPEG · PNG · WebP · GIF · max 8MB · copyright-free only
        </span>
        {hint?.trim() ? <span className="max-w-[28rem] text-xs leading-relaxed text-muted-foreground">{hint.trim()}</span> : null}
      </button>

      {compact && urlLooksLikeImage ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS thumbnails */}
          <img
            src={previewSrc || trimmedValue}
            alt=""
            className="h-auto max-h-28 w-auto max-w-full rounded-md border border-border object-contain"
          />
        </div>
      ) : null}

      {!compact && urlLooksLikeImage ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CMS previews */}
          <img
            src={previewSrc || trimmedValue}
            alt=""
            className="h-auto max-h-40 w-auto max-w-full rounded-md border border-border object-contain shadow-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
