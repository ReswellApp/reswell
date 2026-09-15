"use client"

import { toast } from "sonner"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { BLOG_IMAGE_MAX_EDGE_PX, BLOG_IMAGES_BUCKET } from "@/lib/blog/blog-images-bucket"
import { createClient } from "@/lib/supabase/client"
import {
  publicStorageObjectUrl,
  uploadStorageObjectWithProgress,
} from "@/lib/supabase/storage-upload-xhr"
import { friendlyBlogImageErrorMessage } from "@/lib/utils/friendly-blog-image-error"
import { isAbortError } from "@/lib/utils/is-abort-error"

const MAX_BYTES = 8 * 1024 * 1024
const UPLOAD_RETRY_ATTEMPTS = 3
const UPLOAD_RETRY_BASE_DELAY_MS = 280

const ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]

function mimeToExt(type: string): string {
  if (type === "image/jpeg") return "jpg"
  if (type === "image/png") return "png"
  if (type === "image/webp") return "webp"
  if (type === "image/gif") return "gif"
  return "webp"
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableBlogUploadError(err: unknown): boolean {
  if (isAbortError(err)) return true
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    message.includes("network error") ||
    /upload failed \(401\)/.test(message) ||
    /upload failed \(408\)/.test(message) ||
    /upload failed \(429\)/.test(message) ||
    /upload failed \(5\d\d\)/.test(message)
  )
}

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      return await task()
    } catch (err) {
      lastError = err
      if (!isRetryableBlogUploadError(err) || attempt >= UPLOAD_RETRY_ATTEMPTS) {
        throw err
      }
      await sleep(UPLOAD_RETRY_BASE_DELAY_MS * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Upload failed")
}

/**
 * Scales down so the longest edge is at most {@link BLOG_IMAGE_MAX_EDGE_PX}. Aspect ratio is preserved
 * (no crop). PNG stays PNG when resized; JPEG/WebP/GIF become JPEG when resized — GIF loses animation
 * unless it already fits the max edge.
 */
async function normalizeBlogUploadImageDimensions(
  file: File,
): Promise<{ file: File; width: number; height: number }> {
  let bitmap: ImageBitmap | null = null

  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new Error("Could not read this image. Try JPEG, PNG, WebP, or GIF.")
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
      throw new Error("Could not process this image.")
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
      throw new Error("Could not encode resized image.")
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

export type BlogUploadedImage = {
  url: string
  width: number
  height: number
}

/**
 * Uploads to public `blog-images` (admin RLS). Requires migrated storage policies + existing bucket row.
 * Only upload images that are copyright-free or owned by Reswell — see blog image guidelines.
 * Aspect ratio is preserved; pixel size is returned so the storefront can render at the true ratio.
 *
 * Uses a resolved JWT + XHR (not `supabase.storage.upload`) so a token-refresh lock cannot
 * abort the request with "signal is aborted without reason".
 */
export async function uploadBlogMediaFile(file: File): Promise<BlogUploadedImage | null> {
  try {
    return await uploadBlogMediaFileInner(file)
  } catch (err) {
    console.error("uploadBlogMediaFile:", err)
    toast.error(friendlyBlogImageErrorMessage(err))
    return null
  }
}

async function uploadBlogMediaFileInner(file: File): Promise<BlogUploadedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (JPEG, PNG, WebP, or GIF).")
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 8MB.")
  }

  const normalized = await withRetry(() => normalizeBlogUploadImageDimensions(file))
  /** Crop/re-encode output can exceed source bytes — clamp after normalize */
  if (normalized.file.size > MAX_BYTES) {
    throw new Error(
      `After resizing (longest side ${BLOG_IMAGE_MAX_EDGE_PX}px), the image must stay under 8MB.`,
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!supabaseUrl || !anonKey) {
    throw new Error("Upload is not configured.")
  }

  const supabase = createClient()
  await requestBlogBucketFromServer()

  let ext =
    ACCEPTED_EXTENSIONS.find((e) => normalized.file.name.toLowerCase().endsWith(`.${e}`)) ??
    mimeToExt(normalized.file.type)
  ext = ACCEPTED_EXTENSIONS.includes(ext) ? ext : mimeToExt(normalized.file.type)

  const contentType = normalized.file.type || `image/${ext === "jpg" ? "jpeg" : ext}`

  const path = await withRetry(async () => {
    const session = await resolveClientSessionForMutation(supabase)
    const accessToken = session?.access_token
    if (!session?.user || !accessToken) {
      throw new Error("Sign in again to upload this image.")
    }

    const attemptPath = `cms/${crypto.randomUUID()}.${ext}`
    await uploadStorageObjectWithProgress({
      supabaseUrl,
      accessToken,
      anonKey,
      bucket: BLOG_IMAGES_BUCKET,
      pathInBucket: attemptPath,
      body: normalized.file,
      contentType,
      upsert: false,
    })
    return attemptPath
  })

  return {
    url: `${publicStorageObjectUrl(supabaseUrl, BLOG_IMAGES_BUCKET, path)}?t=${Date.now()}`,
    width: normalized.width,
    height: normalized.height,
  }
}
