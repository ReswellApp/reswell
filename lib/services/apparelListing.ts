/**
 * Business logic for creating a apparel listing. A apparel is a single `listings`
 * row (section = 'apparel') that carries both the shared commerce fields and the
 * apparel-specific attributes (size, brand, model), with photos in
 * `listing_images`.
 *
 * Modeled on `lib/services/finListing.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { persistableListingThumbnailUrl } from "@/lib/listing-media-proxy-url"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { APPAREL_SECTION, APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { buildApparelListingPersistFields } from "@/lib/apparel-listing-persist-fields"
import { syncListingImages } from "@/lib/services/sync-listing-images"
import {
  insertListingVideos,
  listingVideosToUpdateOps,
  syncListingVideos,
} from "@/lib/services/sync-listing-videos"
import type {
  CreateApparelListingInput,
  UpdateApparelListingInput,
} from "@/lib/validations/apparel-listing"

export type CreateApparelListingResult = { listingId: string; slug: string }

async function assertApparelSellAllowed(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  if (!APPAREL_SELL_ADMIN_ONLY) return
  const isAdmin = await fetchProfileIsAdmin(supabase, userId)
  if (!isAdmin) {
    throw new Error("Apparel listings are not open to the public yet.")
  }
}

export type ApparelListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

export async function syncApparelListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: ApparelListingImageUpdateOp[],
): Promise<void> {
  await syncListingImages(supabase, listingId, removedImageIds, images)
}

export async function updateApparelListing(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
  input: UpdateApparelListingInput,
): Promise<{ slug: string }> {
  await assertApparelSellAllowed(supabase, userId)

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
  if (existing.section !== APPAREL_SECTION) {
    throw new Error("Only apparel listings can be edited here")
  }
  if (existing.status === "sold") {
    throw new Error("Sold listings cannot be edited")
  }

  const updateFields = buildApparelListingPersistFields(input)
  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update(updateFields)
    .eq("id", listingId)
    .eq("user_id", userId)
    .select("slug")
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to update apparel listing")
  }

  const imageOps: ApparelListingImageUpdateOp[] = input.images.map((img, index) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl ?? null,
    isPrimary: img.isPrimary ?? index === 0,
    sortOrder: img.sortOrder ?? index,
  }))

  await syncApparelListingImages(supabase, listingId, input.removedImageIds ?? [], imageOps)
  await syncListingVideos(
    supabase,
    listingId,
    input.removedVideoIds ?? [],
    listingVideosToUpdateOps(input.videos ?? []),
  )

  return { slug: (updated.slug as string) ?? (existing.slug as string) }
}

export async function createApparelListing(
  supabase: SupabaseClient,
  userId: string,
  input: CreateApparelListingInput,
): Promise<CreateApparelListingResult> {
  await assertApparelSellAllowed(supabase, userId)

  const slug = await generateUniqueListingSlug(supabase, input.title)
  const persistFields = buildApparelListingPersistFields(input)
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
    throw new Error(listingError?.message ?? "Failed to create apparel listing")
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
