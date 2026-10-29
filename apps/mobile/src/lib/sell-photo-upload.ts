import { manipulateAsync, SaveFormat } from "expo-image-manipulator"
import { Image as RNImage } from "react-native"
import type { MobileSellPhoto } from "@reswell/api-contract"
import { getSupabase } from "@/lib/supabase"
import { publicSupabaseUrl } from "@/lib/public-env"

/** Same long-edge caps as website `lib/listing-image-pipeline.ts`. */
const FULL_MAX_LONG_EDGE = 2000
const THUMB_MAX_LONG_EDGE = 640
const FULL_JPEG_QUALITY = 0.82
const THUMB_JPEG_QUALITY = 0.74
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024

function listingObjectPublicUrl(pathInBucket: string): string {
  const base = publicSupabaseUrl().replace(/\/$/, "")
  const encoded = pathInBucket
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  return `${base}/storage/v1/object/public/listings/${encoded}`
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error("Couldn't read that photo")),
    )
  })
}

async function prepareJpeg(uri: string, maxLongEdge: number, quality: number): Promise<{ uri: string; bytes: ArrayBuffer }> {
  const { width, height } = await imageSize(uri)
  const longEdge = Math.max(width, height)
  const actions =
    longEdge > maxLongEdge
      ? width >= height
        ? [{ resize: { width: maxLongEdge } }]
        : [{ resize: { height: maxLongEdge } }]
      : []
  const prepared = await manipulateAsync(uri, actions, {
    compress: quality,
    format: SaveFormat.JPEG,
  })
  const response = await fetch(prepared.uri)
  if (!response.ok) throw new Error("Couldn't read that photo")
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength <= 0) throw new Error("Couldn't read that photo")
  if (bytes.byteLength > MAX_ORIGINAL_BYTES) {
    throw new Error("This photo is too large after compression. Try another one.")
  }
  return { uri: prepared.uri, bytes }
}

async function uploadListingBlob(pathInBucket: string, bytes: ArrayBuffer): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Sign in again to upload photos.")
  const { error } = await supabase.storage.from("listings").upload(pathInBucket, bytes, {
    contentType: "image/jpeg",
    upsert: false,
    cacheControl: "31536000",
  })
  if (error) throw new Error(error.message || "Couldn't upload that photo")
}

/**
 * Same shape as website sell photos: prepare JPEG variants on device, then upload
 * directly to the `listings` bucket with the seller's session (RLS: `${uid}/…`).
 * Avoids shipping originals through Vercel (4.5MB body + Active CPU on every shot).
 */
export async function uploadSellPhotoToListingsStorage(uri: string): Promise<MobileSellPhoto> {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Sign in again to upload photos.")
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Sign in again to upload photos.")

  let full: { uri: string; bytes: ArrayBuffer }
  let thumb: { uri: string; bytes: ArrayBuffer }
  try {
    full = await prepareJpeg(uri, FULL_MAX_LONG_EDGE, FULL_JPEG_QUALITY)
    thumb = await prepareJpeg(full.uri, THUMB_MAX_LONG_EDGE, THUMB_JPEG_QUALITY)
  } catch (cause) {
    if (cause instanceof Error && cause.message.trim()) throw cause
    throw new Error("Couldn't read that photo")
  }

  const stamp = `${Date.now()}-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2)
  }`
  const fullPath = `${user.id}/${stamp}-full.jpg`
  const thumbPath = `${user.id}/${stamp}-thumb.jpg`

  try {
    await uploadListingBlob(thumbPath, thumb.bytes)
    await uploadListingBlob(fullPath, full.bytes)
  } catch (cause) {
    await supabase.storage.from("listings").remove([fullPath, thumbPath])
    throw cause instanceof Error ? cause : new Error("Couldn't upload that photo")
  }

  return {
    url: listingObjectPublicUrl(fullPath),
    thumbnail_url: listingObjectPublicUrl(thumbPath),
  }
}
