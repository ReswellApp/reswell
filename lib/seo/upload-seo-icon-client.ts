"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

const ICON_MAX_BYTES = 1 * 1024 * 1024
const ALLOWED_EXT = ["png", "svg", "ico", "webp", "jpg", "jpeg", "gif"] as const

/** Upload a favicon / app icon to the public `seo-assets` bucket; returns its public URL or null. */
export async function uploadSeoIconFile(file: File): Promise<string | null> {
  const isImage = file.type.startsWith("image/")
  if (!isImage) {
    toast.error("Please choose an image file (PNG, SVG, or ICO)")
    return null
  }
  if (file.size > ICON_MAX_BYTES) {
    toast.error("Icon must be under 1MB")
    return null
  }

  const supabase = createClient()
  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const safeExt = (ALLOWED_EXT as readonly string[]).includes(ext) ? ext : "png"
  const path = `icons/${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from("seo-assets").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) {
    console.error("uploadSeoIconFile:", error)
    toast.error(error.message || "Upload failed")
    return null
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("seo-assets").getPublicUrl(path)
  return publicUrl
}
