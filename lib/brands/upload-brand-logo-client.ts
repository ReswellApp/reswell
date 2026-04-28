"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

const LOGO_MAX = 5 * 1024 * 1024

/** Upload to `brand-assets` bucket; returns public URL or null on failure. */
export async function uploadBrandLogoFile(file: File): Promise<string | null> {
  if (file.size > LOGO_MAX) {
    toast.error("Image must be under 5MB")
    return null
  }
  const supabase = createClient()
  const ext = (file.name.split(".").pop() || "png").toLowerCase()
  const safeExt = ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) ? ext : "png"
  const path = `logos/${crypto.randomUUID()}.${safeExt}`
  const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: false })
  if (error) {
    console.error(error)
    toast.error(error.message || "Upload failed")
    return null
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("brand-assets").getPublicUrl(path)
  return `${publicUrl}?t=${Date.now()}`
}
