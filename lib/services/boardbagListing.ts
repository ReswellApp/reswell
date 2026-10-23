/**
 * Business logic for creating a boardbag listing. A boardbag is a single `listings`
 * row (section = 'boardbags') that carries both the shared commerce fields and the
 * boardbag-specific attributes (size, brand, model), with photos in
 * `listing_images`.
 *
 * Modeled on `lib/services/finListing.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { persistableListingThumbnailUrl } from "@/lib/listing-media-proxy-url"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { BOARDBAGS_SECTION } from "@/lib/boardbag-listing-config"
import { buildBoardbagListingPersistFields } from "@/lib/boardbag-listing-persist-fields"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  insertListingVideos,
  listingVideosToUpdateOps,
  syncListingVideos,
} from "@/lib/services/sync-listing-videos"
import type {
  CreateBoardbagListingInput,
  UpdateBoardbagListingInput,
} from "@/lib/validations/boardbag-listing"

export type CreateBoardbagListingResult = { listingId: string; slug: string }

export type BoardbagListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

export async function syncBoardbagListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: BoardbagListingImageUpdateOp[],
): Promise<void> {
  await syncListingImages(supabase, listingId, removedImageIds, images)
}

export async function updateBoardbagListing(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
  input: UpdateBoardbagListingInput,
): Promise<{ slug: string }> {
  const { data: existing, error: existingErr } = await supabase
    .from("listings")
    .select("id, user_id, section, status, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (existingErr) {
    throw new Error(existingErr.message)
  }
  if (!existing) {
    throw new Error("Listing not found")
  }
  if (existing.user_id !== userId) {
    throw new Error("You can only edit your own listings")
  }
  if (existing.section !== BOARDBAGS_SECTION) {
    throw new Error("Only boardbag listings can be edited here")
  }
  if (existing.status === "sold") {
    throw new Error("Sold listings cannot be edited")
  }

  const updateFields = buildBoardbagListingPersistFields(input, {
    allowPrivilegedShippingModes: true,
  })
  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update(updateFields)
    .eq("id", listingId)
    .eq("user_id", userId)
    .select("slug")
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to update boardbag listing")
  }

  const imageOps: BoardbagListingImageUpdateOp[] = input.images.map((img, index) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl ?? null,
    isPrimary: img.isPrimary ?? index === 0,
    sortOrder: img.sortOrder ?? index,
  }))

  await syncBoardbagListingImages(supabase, listingId, input.removedImageIds ?? [], imageOps)
  await syncListingVideos(
    supabase,
    listingId,
    input.removedVideoIds ?? [],
    listingVideosToUpdateOps(input.videos ?? []),
  )

  return { slug: (updated.slug as string) ?? (existing.slug as string) }
}

export async function createBoardbagListing(
  supabase: SupabaseClient,
  userId: string,
  input: CreateBoardbagListingInput,
): Promise<CreateBoardbagListingResult> {
  const slug = await generateUniqueListingSlug(supabase, input.title)
  const persistFields = buildBoardbagListingPersistFields(input, {
    allowPrivilegedShippingModes: true,
  })
  const { updated_at: _omitUpdatedAt, ...insertFields } = persistFields

  const { data: inserted, error: listingError } = await supabase
    .from("listings")
    .insert({
      user_id: userId,
      status: "active",
      slug,
      ...insertFields,
    })
    .select("id, slug")
    .single()

  if (listingError || !inserted) {
    throw new Error(listingError?.message ?? "Failed to create boardbag listing")
  }

  const listingId = inserted.id as string

  const imageRows = input.images.map((img, index) => ({
    listing_id: listingId,
    url: img.url,
    thumbnail_url: persistableListingThumbnailUrl(img.thumbnailUrl, img.url),
    is_primary: img.isPrimary ?? index === 0,
    sort_order: img.sortOrder ?? index,
  }))

  const { error: imageError } = await supabase.from("listing_images").insert(imageRows)
  if (imageError) {
    await supabase.from("listings").delete().eq("id", listingId)
    throw new Error(imageError.message)
  }

  try {
    await insertListingVideos(
      supabase,
      listingId,
      listingVideosToUpdateOps(input.videos ?? []),
    )
  } catch (err) {
    await supabase.from("listings").delete().eq("id", listingId)
    throw err instanceof Error ? err : new Error("Failed to insert listing videos")
  }

  return { listingId, slug: (inserted.slug as string) ?? slug }
}
