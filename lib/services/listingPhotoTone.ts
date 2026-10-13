import type { SupabaseClient } from "@supabase/supabase-js"
import { expirePublicListingSurfacesAfterEdit } from "@/lib/cache/revalidate-listing-after-edit"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  fetchListingPhotoToneImages,
  fetchListingPhotoToneListing,
  updateListingPhotoToneImage,
  type ListingPhotoToneImageRow,
  type ListingPhotoToneListingRow,
} from "@/lib/db/listing-photo-tone"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import { listingStorageObjectPathFromUrl } from "@/lib/listing-media-src"
import { renderListingPhotoToneDerivatives } from "@/lib/services/listing-photo-tone-image"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { listingObjectPublicUrl } from "@/lib/supabase/storage-upload-xhr"
import {
  isListingPhotoToneIdentity,
  listingPhotoToneObjectsToRemove,
  listingPhotoToneSourceUrl,
  listingPhotoTonesEqual,
  listingPhotoToneFromImageRow,
  listingPhotoToneStoragePaths,
  type ListingPhotoTone,
  type ListingPhotoToneSavedImage,
} from "@/lib/utils/listing-photo-tone"

const MAX_SOURCE_BYTES = 25 * 1024 * 1024

class ListingPhotoToneError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type { ListingPhotoToneSavedImage }

export type SaveListingPhotoTonesResult =
  | { ok: true; images: ListingPhotoToneSavedImage[] }
  | { ok: false; status: number; error: string }

type ToneWrite = ListingPhotoTone & { id: string }

function savedFromRow(
  row: ListingPhotoToneImageRow,
  tone: ListingPhotoTone,
  url: string,
  thumbnailUrl: string | null,
  sourceUrl: string | null,
): ListingPhotoToneSavedImage {
  return {
    id: row.id,
    url,
    thumbnailUrl,
    sourceUrl,
    brightness: tone.brightness,
    highlights: tone.highlights,
    shadows: tone.shadows,
    contrast: tone.contrast,
  }
}

function sourceThumbnailUrl(row: ListingPhotoToneImageRow): string | null {
  if (row.tone_source_url?.trim()) return row.tone_source_thumbnail_url?.trim() || null
  return row.thumbnail_url?.trim() || null
}

async function downloadListingPhoto(
  supabase: SupabaseClient,
  sourceUrl: string,
): Promise<{ ok: true; bytes: Buffer } | { ok: false; error: string }> {
  const objectPath = listingStorageObjectPathFromUrl(sourceUrl)
  if (!objectPath || !isValidListingMediaObjectPath(objectPath)) {
    return { ok: false, error: "This photo is not stored on Reswell" }
  }

  const { data, error } = await supabase.storage.from("listings").download(objectPath)
  if (error || !data) {
    return { ok: false, error: "Could not read the listing photo" }
  }

  const bytes = Buffer.from(await data.arrayBuffer())
  if (bytes.byteLength < 32 || bytes.byteLength > MAX_SOURCE_BYTES) {
    return { ok: false, error: "Could not read the listing photo" }
  }
  return { ok: true, bytes }
}

async function uploadWebp(
  supabase: SupabaseClient,
  pathInBucket: string,
  body: Buffer,
): Promise<void> {
  const { error } = await supabase.storage.from("listings").upload(pathInBucket, body, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000",
  })
  if (error) throw new Error(error.message || "Upload failed")
}

async function bakeListingPhotoTone(input: {
  supabase: SupabaseClient
  listing: ListingPhotoToneListingRow
  row: ListingPhotoToneImageRow
  tone: ListingPhotoTone
  stamp: string
}): Promise<ListingPhotoToneSavedImage> {
  const sourceUrl = listingPhotoToneSourceUrl(input.row)
  const sourceThumb = sourceThumbnailUrl(input.row)
  const downloaded = await downloadListingPhoto(input.supabase, sourceUrl)
  if (!downloaded.ok) throw new ListingPhotoToneError(400, downloaded.error)

  const derivatives = await renderListingPhotoToneDerivatives(downloaded.bytes, input.tone)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) throw new Error("Upload is not configured")

  const paths = listingPhotoToneStoragePaths(input.listing.user_id, input.stamp, input.row.id)
  const files = [
    { path: paths.full, body: derivatives.full },
    { path: paths.thumb, body: derivatives.thumb },
    { path: paths.card, body: derivatives.card },
    { path: paths.film, body: derivatives.film },
  ]

  const uploaded: string[] = []
  try {
    for (const file of files) {
      await uploadWebp(input.supabase, file.path, file.body)
      uploaded.push(file.path)
    }
  } catch (error) {
    await removeListingImageFilesFromStorage(
      input.supabase,
      uploaded.map((path) => listingObjectPublicUrl(supabaseUrl, path)),
    )
    throw error
  }

  const fullUrl = listingObjectPublicUrl(supabaseUrl, paths.full)
  const thumbUrl = listingObjectPublicUrl(supabaseUrl, paths.thumb)
  const written = await updateListingPhotoToneImage(input.supabase, input.listing.id, {
    id: input.row.id,
    url: fullUrl,
    thumbnailUrl: thumbUrl,
    sourceUrl,
    sourceThumbnailUrl: sourceThumb,
    tone: input.tone,
  })
  if (!written.ok) {
    await removeListingImageFilesFromStorage(
      input.supabase,
      uploaded.map((path) => listingObjectPublicUrl(supabaseUrl, path)),
    )
    throw new Error(written.message)
  }

  await removeListingImageFilesFromStorage(
    input.supabase,
    listingPhotoToneObjectsToRemove({
      previousFullUrl: input.row.url,
      previousThumbUrl: input.row.thumbnail_url,
      sourceFullUrl: sourceUrl,
    }),
  )

  return savedFromRow(input.row, input.tone, fullUrl, thumbUrl, sourceUrl)
}

async function restoreListingPhotoTone(input: {
  supabase: SupabaseClient
  listing: ListingPhotoToneListingRow
  row: ListingPhotoToneImageRow
  tone: ListingPhotoTone
}): Promise<ListingPhotoToneSavedImage> {
  const sourceUrl = input.row.tone_source_url?.trim() || input.row.url
  const sourceThumb = sourceThumbnailUrl(input.row)
  const written = await updateListingPhotoToneImage(input.supabase, input.listing.id, {
    id: input.row.id,
    url: sourceUrl,
    thumbnailUrl: sourceThumb,
    sourceUrl: input.row.tone_source_url?.trim() || null,
    sourceThumbnailUrl: input.row.tone_source_url?.trim() ? sourceThumb : null,
    tone: input.tone,
  })
  if (!written.ok) throw new Error(written.message)

  await removeListingImageFilesFromStorage(
    input.supabase,
    listingPhotoToneObjectsToRemove({
      previousFullUrl: input.row.url,
      previousThumbUrl: input.row.thumbnail_url,
      sourceFullUrl: sourceUrl,
    }),
  )

  return savedFromRow(input.row, input.tone, sourceUrl, sourceThumb, input.row.tone_source_url?.trim() || null)
}

/**
 * Bake admin tone into the listing's stored photos and the card, film, and
 * thumb derivatives `/l` serves. Rebases from the unedited source. Admins only.
 */
export async function saveListingPhotoTones(
  userSupabase: SupabaseClient,
  params: {
    listingId: string
    actorUserId: string
    images: ToneWrite[]
  },
): Promise<SaveListingPhotoTonesResult> {
  const listingId = params.listingId.trim()
  if (!listingId) return { ok: false, status: 400, error: "Missing listing id" }

  const isAdmin = await fetchProfileIsAdmin(userSupabase, params.actorUserId)
  if (!isAdmin) return { ok: false, status: 403, error: "Admins only" }

  const service = createServiceRoleClient()
  const listing = await fetchListingPhotoToneListing(service, listingId)
  if (!listing) return { ok: false, status: 404, error: "Listing not found" }

  const loaded = await fetchListingPhotoToneImages(
    service,
    listingId,
    params.images.map((image) => image.id),
  )
  if (loaded.error) {
    console.error("[listingPhotoTone] load failed", { listingId, message: loaded.error })
    return { ok: false, status: 500, error: "Could not save photo adjustments" }
  }

  const byId = new Map(loaded.data.map((row) => [row.id, row]))
  if (params.images.some((image) => !byId.has(image.id))) {
    return { ok: false, status: 400, error: "Photo is not on this listing" }
  }

  const saved: ListingPhotoToneSavedImage[] = []
  const stamp = Date.now().toString(36)

  try {
    for (let index = 0; index < params.images.length; index += 1) {
      const requested = params.images[index]
      if (!requested) continue
      const row = byId.get(requested.id)
      if (!row) continue
      const tone = {
        brightness: requested.brightness,
        highlights: requested.highlights,
        shadows: requested.shadows,
        contrast: requested.contrast,
      }
      if (listingPhotoTonesEqual(tone, listingPhotoToneFromImageRow(row))) {
        saved.push(
          savedFromRow(
            row,
            listingPhotoToneFromImageRow(row),
            row.url,
            row.thumbnail_url,
            row.tone_source_url,
          ),
        )
        continue
      }

      const next = isListingPhotoToneIdentity(tone)
        ? await restoreListingPhotoTone({ supabase: service, listing, row, tone })
        : await bakeListingPhotoTone({
            supabase: service,
            listing,
            row,
            tone,
            stamp: `${stamp}${index}`,
          })
      saved.push(next)
    }
  } catch (error) {
    if (error instanceof ListingPhotoToneError) {
      return { ok: false, status: error.status, error: error.message }
    }
    console.error("[listingPhotoTone] save failed", {
      listingId,
      actorUserId: params.actorUserId,
      message: error instanceof Error ? error.message : "save failed",
    })
    return { ok: false, status: 500, error: "Could not save photo adjustments" }
  }

  expirePublicListingSurfacesAfterEdit(listingId, listing.slug)
  return { ok: true, images: saved }
}
