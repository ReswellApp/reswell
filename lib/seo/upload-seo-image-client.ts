"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

const SEO_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ["png", "jpg", "jpeg", "webp", "gif"] as const

/** Upload a share image to the public `seo-assets` bucket; returns its public URL or null. */
export async function uploadSeoImageFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    toast.error("Please choose an image file")
    return null
  }
  if (file.size > SEO_IMAGE_MAX_BYTES) {
    toast.error("Image must be under 5MB")
    return null
  }

  const supabase = createClient()
  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const safeExt = (ALLOWED_EXT as readonly string[]).includes(ext) ? ext : "png"
  const path = `share-images/${crypto.randomUUID()}.${safeExt}`

  const { error } = await supabase.storage.from("seo-assets").upload(path, file, { upsert: false })
  if (error) {
    console.error("uploadSeoImageFile:", error)
    toast.error(error.message || "Upload failed")
    return null
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("seo-assets").getPublicUrl(path)
  return publicUrl
}
