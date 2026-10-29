import type {
  MobileSellDraft,
  MobileSellPhoto,
  MobileSellPublish,
  MobileSellPublishResult,
} from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import sharp from "sharp"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import { decodeImageBufferForSharp } from "@/lib/services/decodeImageForSharp"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { mobileSellDraftFields, mobileSellListingFields } from "@/lib/services/mobileSellListingFields"
import { applyPublishedListingSideEffects } from "@/lib/services/publishListingDraft"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  assertMobileSellVideos,
  replaceListingVideos,
} from "@/lib/services/mobileSellVideos"
import { verifyListingImageObjectsExist } from "@/lib/services/verifyListingImageStorage"
import { verifyStorageObjectExists } from "@/lib/supabase/storage-object-exists"
import { SERVER_IMAGE_CONVERT_MAX_BYTES } from "@/lib/utils/server-image-convert"

/** Fallback path only — prefer device → Supabase storage (see apps/mobile sell-photo-upload). */
const PHOTO_MAX_BYTES = SERVER_IMAGE_CONVERT_MAX_BYTES

function ownedListingImage(url: string, userId: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!supabaseUrl) return false
  return url.startsWith(listingObjectPublicUrl(supabaseUrl, `${userId}/`))
}

async function assertMobileSellImagesInStorage(
  images: MobileSellPhoto[],
): Promise<string | null> {
  for (const image of images) {
    const ok = await verifyListingImageObjectsExist(image.url, image.thumbnail_url)
    if (!ok) {
      return "Upload the listing photos again"
    }
  }
  return null
}

/**
 * Fallback for clients that still POST bytes through Vercel.
 * Primary mobile path prepares JPEGs on device and uploads to `listings` directly.
 */
export async function uploadMobileSellPhotoService(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<MobileApiResult<MobileSellPhoto>> {
  if (file.size > PHOTO_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Each photo must be under ${(PHOTO_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB when uploaded through the API`,
    }
  }
  try {
    const raw = Buffer.from(await file.arrayBuffer())
    const source = await decodeImageBufferForSharp(raw, {
      originalFilename: file.name || "photo.jpg",
      mimeType: file.type || "image/jpeg",
    })
    const image = sharp(source, { failOn: "none" }).rotate()
    const full = await image
      .clone()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    const thumb = await image
      .clone()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 74 })
      .toBuffer()
    const stamp = `${Date.now()}-${crypto.randomUUID()}`
    const fullPath = `${userId}/${stamp}-full.jpg`
    const thumbPath = `${userId}/${stamp}-thumb.jpg`
    const uploaded = await supabase.storage.from("listings").upload(fullPath, full, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "31536000",
    })
    if (uploaded.error) return { ok: false, status: 400, error: "Couldn't upload that photo" }
    const thumbUploaded = await supabase.storage.from("listings").upload(thumbPath, thumb, {
      contentType: "image/jpeg",
      upsert: false,
      cacheControl: "31536000",
    })
    if (thumbUploaded.error) {
      await supabase.storage.from("listings").remove([fullPath])
      return { ok: false, status: 400, error: "Couldn't upload that photo" }
    }
    const fullReadable = await verifyStorageObjectExists("listings", fullPath)
    const thumbReadable = await verifyStorageObjectExists("listings", thumbPath)
    if (!fullReadable || !thumbReadable) {
      await supabase.storage.from("listings").remove([fullPath, thumbPath])
      return { ok: false, status: 400, error: "Couldn't upload that photo" }
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    return {
      ok: true,
      data: {
        url: listingObjectPublicUrl(supabaseUrl, fullPath),
        thumbnail_url: listingObjectPublicUrl(supabaseUrl, thumbPath),
      },
    }
  } catch (cause) {
    console.error("[mobile-api] sell photo upload failed", {
      userId,
      timestamp: new Date().toISOString(),
      message: cause instanceof Error ? cause.message : String(cause),
    })
    const message = cause instanceof Error ? cause.message : ""
    if (/heic|heif|unsupported|corrupted/i.test(message)) {
      return { ok: false, status: 400, error: "Couldn't read that photo. Try exporting it as JPEG from Photos." }
    }
    return { ok: false, status: 400, error: "Couldn't read that photo" }
  }
}

export async function replaceListingImages(
  supabase: SupabaseClient,
  listingId: string,
  images: MobileSellPhoto[],
): Promise<string | null> {
  const previous = await supabase.from("listing_images").select("id").eq("listing_id", listingId)
  const previousIds = (previous.data ?? []).map((row) => row.id as string)
  try {
    await syncListingImages(
      supabase,
      listingId,
      previousIds,
      images.map((image, index) => ({
        url: image.url,
        thumbnailUrl: image.thumbnail_url,
        isPrimary: index === 0,
        sortOrder: index,
      })),
    )
  } catch (error) {
    console.error("[mobile-api] listing_images sync failed", {
      listingId,
      message: error instanceof Error ? error.message : String(error),
    })
    return "Couldn't save the listing photos"
  }
  return null
}

export async function saveMobileSellDraftService(
  supabase: SupabaseClient,
  userId: string,
  input: MobileSellDraft,
): Promise<MobileApiResult<MobileSellPublishResult>> {
  if (input.images.some((image) => !ownedListingImage(image.url, userId) || !ownedListingImage(image.thumbnail_url, userId))) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  const storageError = await assertMobileSellImagesInStorage(input.images)
  if (storageError) return { ok: false, status: 400, error: storageError }
  const videoError = await assertMobileSellVideos(input.videos, userId)
  if (videoError) return { ok: false, status: 400, error: videoError }
  const built = mobileSellDraftFields(input)
  if (!built.ok) return { ok: false, status: 400, error: built.error }

  let listingId = input.id
  let slug = ""
  if (listingId) {
    const existing = await supabase.from("listings").select("id, user_id, status, slug").eq("id", listingId).maybeSingle()
    if (existing.error || !existing.data) return { ok: false, status: 400, error: "Draft not found" }
    if (existing.data.user_id !== userId) return { ok: false, status: 403, error: "Draft not found" }
    if (existing.data.status !== "draft") return { ok: false, status: 400, error: "This draft was already published" }
    slug = (existing.data.slug as string | null) || (await generateUniqueListingSlug(supabase, String(built.fields.title)))
    const updated = await supabase.from("listings").update({ ...built.fields, slug }).eq("id", listingId).eq("user_id", userId)
    if (updated.error) return { ok: false, status: 400, error: "Couldn't save this draft" }
  } else {
    slug = await generateUniqueListingSlug(supabase, String(built.fields.title))
    const created = await supabase
      .from("listings")
      .insert({ user_id: userId, slug, ...built.fields })
      .select("id, slug")
      .single()
    if (created.error || !created.data) return { ok: false, status: 400, error: "Couldn't save this draft" }
    listingId = created.data.id as string
    slug = (created.data.slug as string) || slug
  }

  if (input.images.length > 0) {
    const imageError = await replaceListingImages(supabase, listingId, input.images)
    if (imageError) return { ok: false, status: 400, error: imageError }
  } else if (input.id) {
    await supabase.from("listing_images").delete().eq("listing_id", listingId)
  }
  if (input.videos !== undefined) {
    const listingVideoError = await replaceListingVideos(supabase, listingId, input.videos)
    if (listingVideoError) return { ok: false, status: 400, error: listingVideoError }
  }
  return { ok: true, data: { id: listingId, slug } }
}

export async function publishMobileListingService(
  supabase: SupabaseClient,
  userId: string,
  input: MobileSellPublish,
): Promise<MobileApiResult<MobileSellPublishResult>> {
  if (input.images.some((image) => !ownedListingImage(image.url, userId) || !ownedListingImage(image.thumbnail_url, userId))) {
    return { ok: false, status: 400, error: "Upload the listing photos again" }
  }
  const storageError = await assertMobileSellImagesInStorage(input.images)
  if (storageError) return { ok: false, status: 400, error: storageError }
  const videoError = await assertMobileSellVideos(input.videos, userId)
  if (videoError) return { ok: false, status: 400, error: videoError }
  const built = mobileSellListingFields(input)
  if (!built.ok) return { ok: false, status: 400, error: built.error }

  const slug = await generateUniqueListingSlug(supabase, input.title)
  let listingId = ""
  let publishedSlug = slug

  if (input.draft_id) {
    const existing = await supabase.from("listings").select("id, user_id, status, slug").eq("id", input.draft_id).maybeSingle()
    if (existing.error || !existing.data || existing.data.user_id !== userId) {
      return { ok: false, status: 400, error: "Draft not found" }
    }
    if (existing.data.status !== "draft") return { ok: false, status: 400, error: "This draft was already published" }
    publishedSlug = (existing.data.slug as string | null) || slug
    const updated = await supabase
      .from("listings")
      .update({ ...built.fields, status: "active", hidden_from_site: false, slug: publishedSlug })
      .eq("id", input.draft_id)
      .eq("user_id", userId)
    if (updated.error) return { ok: false, status: 400, error: "Couldn't publish this listing" }
    listingId = input.draft_id
  } else {
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .insert({ user_id: userId, status: "active", hidden_from_site: false, slug, ...built.fields })
      .select("id, slug")
      .single()
    if (listingError || !listing) {
      console.error("[mobile-api] sell publish failed", {
        userId,
        timestamp: new Date().toISOString(),
        message: listingError?.message ?? "No listing returned",
      })
      return { ok: false, status: 400, error: "Couldn't publish this listing" }
    }
    listingId = listing.id as string
    publishedSlug = (listing.slug as string) || slug
  }

  const imageError = await replaceListingImages(supabase, listingId, input.images)
  if (imageError) {
    if (input.draft_id) {
      await supabase.from("listings").update({ status: "draft", hidden_from_site: true }).eq("id", listingId).eq("user_id", userId)
    } else {
      await supabase.from("listings").delete().eq("id", listingId).eq("user_id", userId)
    }
    return { ok: false, status: 400, error: imageError }
  }

  if (input.videos !== undefined) {
    const listingVideoError = await replaceListingVideos(supabase, listingId, input.videos)
    if (listingVideoError) {
      if (input.draft_id) {
        await supabase.from("listings").update({ status: "draft", hidden_from_site: true }).eq("id", listingId).eq("user_id", userId)
      } else {
        await supabase.from("listings").delete().eq("id", listingId).eq("user_id", userId)
      }
      return { ok: false, status: 400, error: listingVideoError }
    }
  }

  void applyPublishedListingSideEffects(supabase, listingId, userId)
  return { ok: true, data: { id: listingId, slug: publishedSlug } }
}
