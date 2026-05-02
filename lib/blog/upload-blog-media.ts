"use client"

import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { BLOG_IMAGES_BUCKET } from "@/lib/blog/blog-images-bucket"

const MAX_BYTES = 8 * 1024 * 1024

/** Stored blog CMS images — landscape 3:2 (pixels). */
const BLOG_IMAGE_WIDTH = 3000
const BLOG_IMAGE_HEIGHT = 2000

/**
 * Center-crops (cover) to {@link BLOG_IMAGE_WIDTH}×{@link BLOG_IMAGE_HEIGHT}. Any raster size is accepted;
 * outputs match source where possible (PNG→PNG when resized; JPEG/WebP/GIF→JPEG when resized — GIF loses animation unless already exact px).
 */
async function normalizeBlogUploadImageDimensions(file: File): Promise<File | null> {
  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)
  } catch {
    toast.error("Could not read this image. Try JPEG, PNG, WebP, or GIF.")
    return null
  }

  try {
    if (bitmap.width === BLOG_IMAGE_WIDTH && bitmap.height === BLOG_IMAGE_HEIGHT) {
      return file
    }

    const canvas = document.createElement("canvas")
    canvas.width = BLOG_IMAGE_WIDTH
    canvas.height = BLOG_IMAGE_HEIGHT
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      toast.error("Could not process this image.")
      return null
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    const scale = Math.max(BLOG_IMAGE_WIDTH / bitmap.width, BLOG_IMAGE_HEIGHT / bitmap.height)
    const drawnW = bitmap.width * scale
    const drawnH = bitmap.height * scale
    const dx = (BLOG_IMAGE_WIDTH - drawnW) / 2
    const dy = (BLOG_IMAGE_HEIGHT - drawnH) / 2
    ctx.drawImage(bitmap, dx, dy, drawnW, drawnH)

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
    return new File([blob], `blog-${crypto.randomUUID()}.${ext}`, { type: outType })
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

/**
 * Uploads to public `blog-images` (admin RLS). Requires migrated storage policies + existing bucket row.
 */
export async function uploadBlogMediaFile(file: File): Promise<string | null> {
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
  if (normalized.size > MAX_BYTES) {
    toast.error(`After resizing to ${BLOG_IMAGE_WIDTH}×${BLOG_IMAGE_HEIGHT}, the image must stay under 8MB.`)
    return null
  }

  const supabase = createClient()

  let ext =
    ACCEPTED_EXTENSIONS.find((e) => normalized.name.toLowerCase().endsWith(`.${e}`)) ??
    mimeToExt(normalized.type)
  ext = ACCEPTED_EXTENSIONS.includes(ext) ? ext : mimeToExt(normalized.type)

  const path = `cms/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).upload(path, normalized, {
    upsert: false,
    contentType: normalized.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
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
  return `${publicUrl}?t=${Date.now()}`
}
