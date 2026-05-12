"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import {
  convertSurferAssetFileToWebpBlob,
  type SurferAssetConvertOptions,
} from "@/lib/surfers/surfer-asset-webp-client"

/** Upload to `surfer-assets` bucket; returns public URL or null on failure. */
export async function uploadSurferPhotoFile(
  file: File,
  convertOptions?: SurferAssetConvertOptions,
): Promise<string | null> {
  const webpBlob = await convertSurferAssetFileToWebpBlob(file, convertOptions)
  if (!webpBlob) return null

  const supabase = createClient()
  const id = crypto.randomUUID()
  const webpFile = new File([webpBlob], `${id}.webp`, { type: "image/webp" })
  const path = `photos/${id}.webp`
  const { error } = await supabase.storage.from("surfer-assets").upload(path, webpFile, { upsert: false })
  if (error) {
    console.error(error)
    toast.error(error.message || "Upload failed")
    return null
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("surfer-assets").getPublicUrl(path)
  return `${publicUrl}?t=${Date.now()}`
}
