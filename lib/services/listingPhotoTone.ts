import type { SupabaseClient } from "@supabase/supabase-js"
import { expirePublicListingSurfacesAfterEdit } from "@/lib/cache/revalidate-listing-after-edit"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  deleteListingPhotoToneAdjustment,
  fetchListingPhotoToneAdjustments,
  fetchListingPhotoToneImages,
  fetchListingPhotoToneListing,
  updateListingPhotoToneImageUrls,
  upsertListingPhotoToneAdjustment,
  type ListingPhotoToneAdjustmentRow,
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
  listingPhotoToneRecipeFromRow,
  listingPhotoToneStoragePaths,
  planListingPhotoToneSave,
  type ListingPhotoTone,
  type ListingPhotoToneRecipe,
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

export type ListingPhotoToneActiveRecipe = {
  id: string
  sourceUrl: string
  brightness: number
  highlights: number
  shadows: number
  contrast: number
}

export type SaveListingPhotoTonesResult =
  | { ok: true; images: ListingPhotoToneSavedImage[] }
  | { ok: false; status: number; error: string }

export type ListListingPhotoToneRecipesResult =
  | { ok: true; images: ListingPhotoToneActiveRecipe[] }
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

function recipeFromRow(row: ListingPhotoToneAdjustmentRow): ListingPhotoToneRecipe | null {
  return listingPhotoToneRecipeFromRow(row)
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

async function removeUploaded(
  supabase: SupabaseClient,
  supabaseUrl: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return
  await removeListingImageFilesFromStorage(
    supabase,
    paths.map((path) => listingObjectPublicUrl(supabaseUrl, path)),
  )
}

/**
 * If the listing row never moved, put the recipe back so the next edit still
 * bakes from the original instead of the previous rendition.
 */
async function rollbackRecipe(
  supabase: SupabaseClient,
  listingId: string,
  imageId: string,
  previous: ListingPhotoToneRecipe | null,
): Promise<void> {
  if (!previous) {
    const deleted = await deleteListingPhotoToneAdjustment(supabase, listingId, imageId)
    if (!deleted.ok) {
      console.error("[listingPhotoTone] recipe rollback failed", {
        listingId,
        imageId,
        message: deleted.message,
      })
    }
    return
  }

  const restored = await upsertListingPhotoToneAdjustment(supabase, {
    imageId,
    listingId,
    sourceUrl: previous.sourceUrl,
    sourceThumbnailUrl: previous.sourceThumbnailUrl,
    renditionUrl: previous.renditionUrl,
    renditionThumbnailUrl: previous.renditionThumbnailUrl,
    tone: previous.tone,
  })
  if (!restored.ok) {
    console.error("[listingPhotoTone] recipe rollback failed", {
      listingId,
      imageId,
      message: restored.message,
    })
  }
}

async function bakeListingPhotoTone(input: {
  supabase: SupabaseClient
  listing: ListingPhotoToneListingRow
  row: ListingPhotoToneImageRow
  previous: ListingPhotoToneRecipe | null
  sourceUrl: string
  sourceThumbnailUrl: string | null
  tone: ListingPhotoTone
  removeUrls: string[]
  stamp: string
}): Promise<ListingPhotoToneSavedImage> {
  const downloaded = await downloadListingPhoto(input.supabase, input.sourceUrl)
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
    await removeUploaded(input.supabase, supabaseUrl, uploaded)
    throw error
  }

  const fullUrl = listingObjectPublicUrl(supabaseUrl, paths.full)
  const thumbUrl = listingObjectPublicUrl(supabaseUrl, paths.thumb)
  const writtenRecipe = await upsertListingPhotoToneAdjustment(input.supabase, {
    imageId: input.row.id,
    listingId: input.listing.id,
    sourceUrl: input.sourceUrl,
    sourceThumbnailUrl: input.sourceThumbnailUrl,
    renditionUrl: fullUrl,
    renditionThumbnailUrl: thumbUrl,
    tone: input.tone,
  })
  if (!writtenRecipe.ok) {
    await removeUploaded(input.supabase, supabaseUrl, uploaded)
    throw new Error(writtenRecipe.message)
  }

  const written = await updateListingPhotoToneImageUrls(input.supabase, input.listing.id, {
    id: input.row.id,
    url: fullUrl,
    thumbnailUrl: thumbUrl,
  })
  if (!written.ok) {
    await rollbackRecipe(input.supabase, input.listing.id, input.row.id, input.previous)
    await removeUploaded(input.supabase, supabaseUrl, uploaded)
    throw new Error(written.message)
  }

  await removeListingImageFilesFromStorage(input.supabase, input.removeUrls)
  return savedFromRow(input.row, input.tone, fullUrl, thumbUrl, input.sourceUrl)
}

async function restoreListingPhotoTone(input: {
  supabase: SupabaseClient
  listing: ListingPhotoToneListingRow
  row: ListingPhotoToneImageRow
  sourceUrl: string
  sourceThumbnailUrl: string | null
  removeUrls: string[]
}): Promise<ListingPhotoToneSavedImage> {
  const written = await updateListingPhotoToneImageUrls(input.supabase, input.listing.id, {
    id: input.row.id,
    url: input.sourceUrl,
    thumbnailUrl: input.sourceThumbnailUrl,
  })
  if (!written.ok) throw new Error(written.message)

  await removeListingImageFilesFromStorage(input.supabase, input.removeUrls)
  const deleted = await deleteListingPhotoToneAdjustment(
    input.supabase,
    input.listing.id,
    input.row.id,
  )
  if (!deleted.ok) throw new Error(deleted.message)

  return savedFromRow(
    input.row,
    { brightness: 0, highlights: 0, shadows: 0, contrast: 0 },
    input.sourceUrl,
    input.sourceThumbnailUrl,
    input.sourceUrl,
  )
}

async function requireAdminListing(
  userSupabase: SupabaseClient,
  listingId: string,
  actorUserId: string,
): Promise<
  | { ok: true; service: SupabaseClient; listing: ListingPhotoToneListingRow }
  | { ok: false; status: number; error: string }
> {
  const isAdmin = await fetchProfileIsAdmin(userSupabase, actorUserId)
  if (!isAdmin) return { ok: false, status: 403, error: "Admins only" }

  const service = createServiceRoleClient()
  const listing = await fetchListingPhotoToneListing(service, listingId)
  if (!listing) return { ok: false, status: 404, error: "Listing not found" }
  return { ok: true, service, listing }
}

/**
 * Recipes whose baked copy is still the photo the listing serves.
 * A replaced upload is omitted so the editor starts from that new original.
 */
export async function listListingPhotoToneRecipes(
  userSupabase: SupabaseClient,
  params: { listingId: string; actorUserId: string },
): Promise<ListListingPhotoToneRecipesResult> {
  const listingId = params.listingId.trim()
  if (!listingId) return { ok: false, status: 400, error: "Missing listing id" }

  const access = await requireAdminListing(userSupabase, listingId, params.actorUserId)
  if (!access.ok) return access

  const loaded = await fetchListingPhotoToneAdjustments(access.service, listingId)
  if (loaded.error) {
    console.error("[listingPhotoTone] load recipes failed", { listingId, message: loaded.error })
    return { ok: false, status: 500, error: "Could not load photo adjustments" }
  }
  if (loaded.data.length === 0) return { ok: true, images: [] }

  const images = await fetchListingPhotoToneImages(
    access.service,
    listingId,
    loaded.data.map((row) => row.image_id),
  )
  if (images.error) {
    console.error("[listingPhotoTone] load photos failed", { listingId, message: images.error })
    return { ok: false, status: 500, error: "Could not load photo adjustments" }
  }

  const byId = new Map(images.data.map((row) => [row.id, row]))
  const active: ListingPhotoToneActiveRecipe[] = []
  for (const row of loaded.data) {
    const image = byId.get(row.image_id)
    const recipe = recipeFromRow(row)
    if (!image || !recipe) continue
    const plan = planListingPhotoToneSave({
      publicUrl: image.url,
      publicThumbnailUrl: image.thumbnail_url,
      requested: recipe.tone,
      recipe,
    })
    if (plan.action !== "skip" || !plan.sourceUrl) continue
    active.push({
      id: row.image_id,
      sourceUrl: plan.sourceUrl,
      brightness: recipe.tone.brightness,
      highlights: recipe.tone.highlights,
      shadows: recipe.tone.shadows,
      contrast: recipe.tone.contrast,
    })
  }

  return { ok: true, images: active }
}

/**
 * Store the sliders as a recipe and bake a new full, thumb, card, and film
 * copy. The upload stays put. Buyers, email, and catalog feeds follow
 * `listing_images`, which points at the new URLs. Revert drops the recipe
 * and the copy. Admins only.
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

  const access = await requireAdminListing(userSupabase, listingId, params.actorUserId)
  if (!access.ok) return access

  const imageIds = params.images.map((image) => image.id)
  const [loaded, adjustments] = await Promise.all([
    fetchListingPhotoToneImages(access.service, listingId, imageIds),
    fetchListingPhotoToneAdjustments(access.service, listingId, imageIds),
  ])
  if (loaded.error || adjustments.error) {
    console.error("[listingPhotoTone] load failed", {
      listingId,
      message: loaded.error ?? adjustments.error,
    })
    return { ok: false, status: 500, error: "Could not save photo adjustments" }
  }

  const byId = new Map(loaded.data.map((row) => [row.id, row]))
  if (params.images.some((image) => !byId.has(image.id))) {
    return { ok: false, status: 400, error: "Photo is not on this listing" }
  }

  const recipes = new Map<string, ListingPhotoToneRecipe>()
  for (const row of adjustments.data) {
    const recipe = recipeFromRow(row)
    if (recipe) recipes.set(row.image_id, recipe)
  }

  const saved: ListingPhotoToneSavedImage[] = []
  const stamp = Date.now().toString(36)

  try {
    for (let index = 0; index < params.images.length; index += 1) {
      const requested = params.images[index]
      if (!requested) continue
      const row = byId.get(requested.id)
      if (!row) continue
      const previous = recipes.get(row.id) ?? null
      const plan = planListingPhotoToneSave({
        publicUrl: row.url,
        publicThumbnailUrl: row.thumbnail_url,
        requested,
        recipe: previous,
      })

      if (plan.action === "skip") {
        saved.push(savedFromRow(row, plan.tone, plan.url, plan.thumbnailUrl, plan.sourceUrl))
        continue
      }

      if (plan.action === "restore") {
        saved.push(
          await restoreListingPhotoTone({
            supabase: access.service,
            listing: access.listing,
            row,
            sourceUrl: plan.sourceUrl,
            sourceThumbnailUrl: plan.sourceThumbnailUrl,
            removeUrls: plan.removeUrls,
          }),
        )
        continue
      }

      saved.push(
        await bakeListingPhotoTone({
          supabase: access.service,
          listing: access.listing,
          row,
          previous,
          sourceUrl: plan.sourceUrl,
          sourceThumbnailUrl: plan.sourceThumbnailUrl,
          tone: plan.tone,
          removeUrls: plan.removeUrls,
          stamp: `${stamp}${index}`,
        }),
      )
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

  expirePublicListingSurfacesAfterEdit(listingId, access.listing.slug)
  return { ok: true, images: saved }
}
