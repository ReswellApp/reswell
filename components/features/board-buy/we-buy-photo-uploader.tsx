"use client"

import * as React from "react"
import { BOARD_BUY_MAX_PHOTO_BYTES, BOARD_BUY_MAX_PHOTOS } from "@/lib/board-buy/constants"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function WeBuyPhotoUploader({
  userId,
  urls,
  onChange,
}: {
  userId: string
  urls: string[]
  onChange: (urls: string[]) => void
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const remaining = BOARD_BUY_MAX_PHOTOS - urls.length
    const picked = Array.from(files).slice(0, remaining)
    if (picked.length === 0) {
      setError(`You can add up to ${BOARD_BUY_MAX_PHOTOS} photos.`)
      return
    }

    setBusy(true)
    const supabase = createClient()
    const uploaded: string[] = []
    try {
      for (const file of picked) {
        if (file.size > BOARD_BUY_MAX_PHOTO_BYTES) {
          throw new Error("Each photo must be under 10 MB.")
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error("Use JPEG, PNG, or WebP photos.")
        }
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
        const path = `${userId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from("board-buy-photos")
          .upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw new Error(uploadError.message)
        const { data } = supabase.storage.from("board-buy-photos").getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      onChange([...urls, ...uploaded])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload photos.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
              onClick={() => onChange(urls.filter((u) => u !== url))}
            >
              Remove
            </button>
          </div>
        ))}
        {urls.length < BOARD_BUY_MAX_PHOTOS ? (
          <label
            className={cn(
              "flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground",
              busy && "opacity-60",
            )}
          >
            {busy ? "Uploading…" : "Add photos"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void onFiles(e.target.files)
                e.target.value = ""
              }}
            />
          </label>
        ) : null}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
