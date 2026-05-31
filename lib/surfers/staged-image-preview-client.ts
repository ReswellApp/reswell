"use client"

import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { browserCanDecodeImage } from "@/lib/listing-image-pipeline"

/**
 * Blob URL suitable for `<img src>` in the current browser. JPEG/PNG/WebP usually decode;
 * HEIC and some RAW types do not — convert in-browser first (same pipeline as /sell uploads).
 */
export async function createPreviewUrlForImageFile(file: File): Promise<{ url: string; revoke: () => void }> {
  const ok = await browserCanDecodeImage(file)
  if (ok) {
    const url = URL.createObjectURL(file)
    return { url, revoke: () => URL.revokeObjectURL(url) }
  }

  const decoded = await ensureBrowserDecodableImageFile(file)
  const url = URL.createObjectURL(decoded)
  return { url, revoke: () => URL.revokeObjectURL(url) }
}
