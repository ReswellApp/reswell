"use client"

import { toast } from "sonner"
import { SURFER_ASSET_RAW_UPLOAD_MAX_BYTES, SURFER_ASSET_STORED_MAX_BYTES } from "@/lib/surfers/surfer-asset-limits"
import { normalizeSurferImageQuarterTurns } from "@/lib/surfers/surfer-image-quarter-turns"

export type SurferAssetConvertOptions = {
  /** Clockwise quarter-turns after EXIF (0–3). */
  rotateQuarterTurns?: number
}

export async function convertSurferAssetFileToWebpBlob(
  file: File,
  options?: SurferAssetConvertOptions,
): Promise<Blob | null> {
  if (file.size > SURFER_ASSET_RAW_UPLOAD_MAX_BYTES) {
    toast.error(`Image must be under ${SURFER_ASSET_RAW_UPLOAD_MAX_BYTES / (1024 * 1024)}MB`)
    return null
  }

  const form = new FormData()
  form.append("file", file)
  const q = normalizeSurferImageQuarterTurns(options?.rotateQuarterTurns ?? 0)
  if (q !== 0) {
    form.append("rotateQuarterTurns", String(q))
  }
  const res = await fetch("/api/admin/surfer-image-to-webp", {
    method: "POST",
    body: form,
    credentials: "include",
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = "Could not process image"
    try {
      const j = JSON.parse(text) as { error?: string }
      if (typeof j.error === "string" && j.error.trim()) msg = j.error.trim()
    } catch {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160)
      msg = snippet
        ? `Could not process image (${res.status}). ${snippet}`
        : `Could not process image (HTTP ${res.status}).`
    }
    toast.error(msg)
    return null
  }

  const blob = await res.blob()
  if (blob.size > SURFER_ASSET_STORED_MAX_BYTES) {
    toast.error("Converted image exceeds storage limit — try a smaller source file")
    return null
  }

  return blob
}
