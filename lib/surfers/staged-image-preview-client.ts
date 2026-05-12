"use client"

import { browserCanDecodeImage } from "@/lib/listing-image-pipeline"

/**
 * Blob URL suitable for `<img src>` in the current browser. JPEG/PNG/WebP usually decode;
 * HEIC and some RAW types do not — match /sell by converting via `/api/convert-image` for preview only.
 * Final upload still uses the original {@link File} (e.g. HEIC → server WebP).
 */
export async function createPreviewUrlForImageFile(file: File): Promise<{ url: string; revoke: () => void }> {
  const ok = await browserCanDecodeImage(file)
  if (ok) {
    const url = URL.createObjectURL(file)
    return { url, revoke: () => URL.revokeObjectURL(url) }
  }

  const form = new FormData()
  form.append("file", file)
  const res = await fetch("/api/convert-image", { method: "POST", body: form })
  const ct = res.headers.get("content-type") || ""
  if (!res.ok) {
    let msg = "Could not prepare a preview for this file"
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string }
        if (j?.error) msg = j.error
      } else {
        const t = await res.text()
        if (t) msg = t.slice(0, 240)
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (!ct.includes("image/")) {
    throw new Error("Preview conversion did not return an image")
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}
