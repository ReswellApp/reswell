"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { BLOG_IMAGE_MAX_EDGE_PX, BLOG_IMAGES_BUCKET } from "@/lib/blog/blog-images-bucket"

const MAX_BYTES = 8 * 1024 * 1024

/**
 * Scales down so the longest edge is at most {@link BLOG_IMAGE_MAX_EDGE_PX}. Aspect ratio is preserved
 * (no crop). PNG stays PNG when resized; JPEG/WebP/GIF become JPEG when resized — GIF loses animation
 * unless it already fits the max edge.
 */
async function normalizeBlogUploadImageDimensions(
  file: File,
): Promise<{ file: File; width: number; height: number } | null> {
  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)
  } catch {
    toast.error("Could not read this image. Try JPEG, PNG, WebP, or GIF.")
    return null
  }

  try {
    const srcW = bitmap.width
    const srcH = bitmap.height
    const longest = Math.max(srcW, srcH)
    if (longest <= BLOG_IMAGE_MAX_EDGE_PX) {
      return { file, width: srcW, height: srcH }
    }

    const scale = BLOG_IMAGE_MAX_EDGE_PX / longest
    const outW = Math.max(1, Math.round(srcW * scale))
    const outH = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      toast.error("Could not process this image.")
      return null
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, outW, outH)

    /** Resized GIF uses first decoded frame → static JPEG */
    const outType = file.type === "image/png" ? "image/png" : "image/jpeg"
    const quality = outType === "image/jpeg" ? 0.92 : undefined

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality)
    })

    if (!blob) {
      toast.error("Could not encode resized image.")
      return null
    }

    const ext = outType === "image/png" ? "png" : "jpg"
    return {
      file: new File([blob], `blog-${crypto.randomUUID()}.${ext}`, { type: outType }),
      width: outW,
      height: outH,
    }
  } finally {
    bitmap.close()
  }
}

/** Best-effort: creates `blog-images` via admin API + service role when migrations are missing. */
async function requestBlogBucketFromServer() {
  if (typeof window === "undefined") return
  try {
    await fetch("/api/admin/blog-images/bucket", { method: "POST", credentials: "same-origin" })
  } catch {
    /* non-blocking */
  }
}

const ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]

function mimeToExt(type: string): string {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  if (type === "image/webp") return "webp"
  if (type === "image/gif") return "gif"
  return "webp"
}

export type BlogUploadedImage = {
  url: string
  width: number
  height: number
}

/**
 * Uploads to public `blog-images` (admin RLS). Requires migrated storage policies + existing bucket row.
 * Only upload images that are copyright-free or owned by Reswell — see blog image guidelines.
 * Aspect ratio is preserved; pixel size is returned so the storefront can render at the true ratio.
 */
export async function uploadBlogMediaFile(file: File): Promise<BlogUploadedImage | null> {
  await requestBlogBucketFromServer()

  if (!file.type.startsWith("image/")) {
    toast.error("Choose an image file (JPEG, PNG, WebP, or GIF).")
    return null
  }
  if (file.size > MAX_BYTES) {
    toast.error("Image must be under 8MB.")
    return null
  }

  const normalized = await normalizeBlogUploadImageDimensions(file)
  if (!normalized) return null
  /** Crop/re-encode output can exceed source bytes — clamp after normalize */
  if (normalized.file.size > MAX_BYTES) {
    toast.error(`After resizing (longest side ${BLOG_IMAGE_MAX_EDGE_PX}px), the image must stay under 8MB.`)
    return null
  }

  const supabase = createClient()

  let ext =
    ACCEPTED_EXTENSIONS.find((e) => normalized.file.name.toLowerCase().endsWith(`.${e}`)) ??
    mimeToExt(normalized.file.type)
  ext = ACCEPTED_EXTENSIONS.includes(ext) ? ext : mimeToExt(normalized.file.type)

  const path = `cms/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).upload(path, normalized.file, {
    upsert: false,
    contentType: normalized.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  })

  if (error) {
    console.error("uploadBlogMediaFile:", error.message)
    if (/bucket not found/i.test(error.message)) {
      toast.error(
        "Blog image bucket is not set up yet. Open the CMS again to sync it, run Supabase migrations, or run the dashboard SQL from the migration file.",
        { duration: 8000 },
      )
      return null
    }
    toast.error(error.message || "Upload failed")
    return null
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path)
  /** Cache-bust CDN after fresh upload */
  return { url: `${publicUrl}?t=${Date.now()}`, width: normalized.width, height: normalized.height }
}
