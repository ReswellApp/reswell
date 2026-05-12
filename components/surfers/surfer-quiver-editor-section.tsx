"use client"

import * as React from "react"
import Image from "next/image"
import { Loader2, RotateCw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  MAX_SURFER_QUIVER_ITEMS,
  type SurferQuiverItem,
  parseSurferQuiverItems,
} from "@/lib/surfers/parse-surfer-quiver-items"
import { createPreviewUrlForImageFile } from "@/lib/surfers/staged-image-preview-client"
import { surferImagePreviewRotateClass } from "@/lib/surfers/surfer-image-quarter-turns"
import { uploadSurferQuiverImageFile } from "@/lib/surfers/upload-surfer-quiver-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type PendingQuiver = {
  id: string
  file: File
  previewUrl: string | null
  previewLoading: boolean
  rotateQuarterTurns: number
  title: string
  description: string
}

function revokePreviewUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url)
}

function nullIfBlank(s: string): string | null {
  const t = s.trim()
  return t || null
}

export function SurferQuiverEditorSection({
  idPrefix,
  items,
  onItemsChange,
  stagingResetKey,
}: {
  idPrefix: string
  items: SurferQuiverItem[]
  onItemsChange: React.Dispatch<React.SetStateAction<SurferQuiverItem[]>>
  stagingResetKey: number
}) {
  const [urlDraft, setUrlDraft] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const [pending, setPending] = React.useState<PendingQuiver[]>([])
  const pendingRef = React.useRef(pending)
  pendingRef.current = pending

  React.useEffect(() => {
    setPending((prev) => {
      for (const p of prev) revokePreviewUrl(p.previewUrl)
      return []
    })
  }, [stagingResetKey])

  React.useEffect(() => {
    return () => {
      for (const p of pendingRef.current) revokePreviewUrl(p.previewUrl)
    }
  }, [])

  function patchItem(index: number, patch: Partial<SurferQuiverItem>) {
    onItemsChange((prev) => prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it)))
  }

  function removeItem(i: number) {
    onItemsChange((prev) => prev.filter((_, idx) => idx !== i))
  }

  function addFromDraft() {
    const t = urlDraft.trim()
    if (!t) return
    onItemsChange((prev) => {
      const next = [...prev, { image_url: t, title: null, description: null }]
      const parsed = parseSurferQuiverItems(next)
      if ("error" in parsed) {
        toast.error(parsed.error)
        return prev
      }
      return parsed
    })
    setUrlDraft("")
  }

  function removePending(id: string) {
    setPending((prev) => {
      const row = prev.find((p) => p.id === id)
      if (row) revokePreviewUrl(row.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function cyclePendingRotateQuarter(id: string) {
    setPending((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotateQuarterTurns: (p.rotateQuarterTurns + 1) % 4 } : p)),
    )
  }

  function onQuiverFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ""
    if (files.length === 0) return
    const remaining = MAX_SURFER_QUIVER_ITEMS - items.length - pending.length
    if (remaining <= 0) {
      toast.error(`At most ${MAX_SURFER_QUIVER_ITEMS} quiver images`)
      return
    }
    const slice = files.slice(0, remaining)
    slice.forEach((file) => {
      const id = crypto.randomUUID()
      setPending((prev) => [
        ...prev,
        {
          id,
          file,
          previewUrl: null,
          previewLoading: true,
          rotateQuarterTurns: 0,
          title: "",
          description: "",
        },
      ])
      void (async () => {
        try {
          const { url } = await createPreviewUrlForImageFile(file)
          setPending((prev) => {
            if (!prev.some((p) => p.id === id)) {
              URL.revokeObjectURL(url)
              return prev
            }
            return prev.map((p) =>
              p.id === id ? { ...p, previewUrl: url, previewLoading: false } : p,
            )
          })
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not show preview")
          setPending((prev) => prev.filter((p) => p.id !== id))
        }
      })()
    })
    if (files.length > remaining) {
      toast.message(`Only ${remaining} slot(s) left — added the first ${remaining}.`)
    }
  }

  function clearPending() {
    setPending((prev) => {
      for (const p of prev) revokePreviewUrl(p.previewUrl)
      return []
    })
  }

  async function uploadPending() {
    if (pending.length === 0) return
    const anyLoading = pending.some((p) => p.previewLoading)
    const allReady = pending.every((p) => !p.previewLoading && p.previewUrl)
    if (anyLoading || !allReady) {
      toast.message("Wait for previews to finish loading.")
      return
    }

    const remaining = MAX_SURFER_QUIVER_ITEMS - items.length
    if (remaining <= 0) {
      toast.error(`At most ${MAX_SURFER_QUIVER_ITEMS} quiver images`)
      return
    }
    const toUpload = pending.slice(0, remaining)
    if (pending.length > remaining) {
      toast.message(`Only ${remaining} slot(s) left — uploading the first ${remaining}.`)
    }

    setUploading(true)
    try {
      const newItems: SurferQuiverItem[] = []
      const succeededIds: string[] = []
      for (const row of toUpload) {
        const u = await uploadSurferQuiverImageFile(row.file, {
          rotateQuarterTurns: row.rotateQuarterTurns,
        })
        if (u) {
          newItems.push({
            image_url: u,
            title: nullIfBlank(row.title),
            description: nullIfBlank(row.description),
          })
          succeededIds.push(row.id)
        }
      }
      if (newItems.length === 0) return

      setPending((pp) => {
        const succ = new Set(succeededIds)
        for (const row of pp) {
          if (succ.has(row.id)) revokePreviewUrl(row.previewUrl)
        }
        return pp.filter((p) => !succ.has(p.id))
      })

      onItemsChange((prev) => {
        const merged = [...prev, ...newItems]
        const parsed = parseSurferQuiverItems(merged)
        if ("error" in parsed) {
          toast.error(parsed.error)
          return prev
        }
        return parsed
      })
    } finally {
      setUploading(false)
    }
  }

  const anyPreviewLoading = pending.some((p) => p.previewLoading)
  const canUploadPending =
    pending.length > 0 && !anyPreviewLoading && pending.every((p) => p.previewUrl)

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-muted/10 p-4">
      <div>
        <Label className="text-base">Quiver photos</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Each board: optional title above the photo, caption below. Up to {MAX_SURFER_QUIVER_ITEMS} entries. HEIC and
          similar formats use a JPEG preview before upload.
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item, i) => (
            <li
              key={`${item.image_url}-${i}`}
              className="space-y-2 rounded-xl border border-border/60 bg-background p-3 shadow-sm"
            >
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-quiver-title-${i}`} className="text-xs text-muted-foreground">
                  Title (optional)
                </Label>
                <Input
                  id={`${idPrefix}-quiver-title-${i}`}
                  value={item.title ?? ""}
                  onChange={(e) => {
                    const v = e.target.value
                    patchItem(i, { title: v === "" ? null : v })
                  }}
                  placeholder="e.g. 6’0 daily driver"
                  maxLength={200}
                />
              </div>
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-muted">
                <Image src={item.image_url} alt="" fill className="object-cover object-center" sizes="200px" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${idPrefix}-quiver-desc-${i}`} className="text-xs text-muted-foreground">
                  Description (optional)
                </Label>
                <Textarea
                  id={`${idPrefix}-quiver-desc-${i}`}
                  value={item.description ?? ""}
                  onChange={(e) => {
                    const v = e.target.value
                    patchItem(i, { description: v === "" ? null : v })
                  }}
                  placeholder="Shape, fins, condition…"
                  rows={3}
                  maxLength={2000}
                  className="min-h-[72px] resize-y text-sm"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => removeItem(i)}
              >
                Remove from quiver
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {pending.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {anyPreviewLoading
              ? "Preparing previews (HEIC may take a moment)…"
              : "Add title / caption, rotate if needed, then upload to quiver."}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pending.map((row) => (
              <li
                key={row.id}
                className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-background p-3"
              >
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Title (optional)</Label>
                  <Input
                    value={row.title}
                    onChange={(e) =>
                      setPending((prev) =>
                        prev.map((p) => (p.id === row.id ? { ...p, title: e.target.value } : p)),
                      )
                    }
                    placeholder="Shown above photo"
                    maxLength={200}
                  />
                </div>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                  {row.previewUrl ? (
                    <img
                      src={row.previewUrl}
                      alt=""
                      className={cn(
                        "absolute inset-0 h-full w-full origin-center object-cover object-center transition-transform duration-200",
                        surferImagePreviewRotateClass(row.rotateQuarterTurns),
                      )}
                    />
                  ) : null}
                  {row.previewLoading ? (
                    <div
                      className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"
                      aria-busy
                    >
                      <Loader2 className="h-6 w-6 animate-spin opacity-70" aria-hidden />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => cyclePendingRotateQuarter(row.id)}
                    disabled={row.previewLoading || !row.previewUrl}
                    className={cn(
                      "absolute left-1 top-1 z-[5] flex h-8 w-8 items-center justify-center rounded-full touch-manipulation",
                      "bg-background/80 shadow-sm ring-1 ring-black/5 hover:bg-background",
                      (row.previewLoading || !row.previewUrl) && "pointer-events-none opacity-40",
                    )}
                    aria-label="Rotate 90 degrees clockwise"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 z-[5] h-8 w-8 rounded-full opacity-95 shadow-sm"
                    onClick={() => removePending(row.id)}
                    aria-label="Remove from queue"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                  <Textarea
                    value={row.description}
                    onChange={(e) =>
                      setPending((prev) =>
                        prev.map((p) => (p.id === row.id ? { ...p, description: e.target.value } : p)),
                      )
                    }
                    placeholder="Shown below photo"
                    rows={3}
                    maxLength={2000}
                    className="min-h-[72px] resize-y text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={uploadPending} disabled={uploading || !canUploadPending}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {pending.length} to quiver
                </>
              )}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearPending} disabled={uploading}>
              Clear queue
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${idPrefix}-quiver-url`} className="text-xs text-muted-foreground">
            Image URL
          </Label>
          <Input
            id={`${idPrefix}-quiver-url`}
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addFromDraft()
              }
            }}
            placeholder="https://…"
            disabled={items.length >= MAX_SURFER_QUIVER_ITEMS}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={addFromDraft}
          disabled={items.length >= MAX_SURFER_QUIVER_ITEMS || !urlDraft.trim()}
        >
          Add URL
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-quiver-files`} className="text-xs text-muted-foreground">
          Choose images to stage
        </Label>
        <Input
          id={`${idPrefix}-quiver-files`}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          disabled={uploading || items.length + pending.length >= MAX_SURFER_QUIVER_ITEMS}
          onChange={onQuiverFiles}
        />
        <p className="text-xs text-muted-foreground">
          Any common image type (including HEIC). Up to 25MB each; converted to WebP before storage (5MB max stored).
        </p>
      </div>
    </div>
  )
}
