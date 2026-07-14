import type { SupabaseClient } from "@supabase/supabase-js"
import { generateUniqueListingSlug } from "@/lib/services/listing-slug"
import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"
import { MAGAZINES_SECTION } from "@/lib/magazine-listing-config"
import { buildMagazineListingPersistFields } from "@/lib/magazine-listing-persist-fields"
import type {
  CreateMagazineListingInput,
  UpdateMagazineListingInput,
} from "@/lib/validations/magazine-listing"

export type CreateMagazineListingResult = { listingId: string; slug: string }

export type MagazineListingImageUpdateOp = {
  id?: string
  url: string
  thumbnailUrl?: string | null
  isPrimary: boolean
  sortOrder: number
}

export async function syncMagazineListingImages(
  supabase: SupabaseClient,
  listingId: string,
  removedImageIds: string[],
  images: MagazineListingImageUpdateOp[],
): Promise<void> {
  if (removedImageIds.length > 0) {
    const { data: removedRows } = await supabase
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .in("id", removedImageIds)
    const removedUrls: string[] = []
    for (const r of removedRows ?? []) {
      if (r.url?.trim()) removedUrls.push(r.url)
      if (r.thumbnail_url?.trim()) removedUrls.push(r.thumbnail_url)
    }
    if (removedUrls.length > 0) {
      await removeListingImageFilesFromStorage(supabase, removedUrls)
    }
    await supabase.from("listing_images").delete().in("id", removedImageIds).eq("listing_id", listingId)
  }

  for (const img of images) {
    if (img.id) {
      const rowUpdate: {
        sort_order: number
        is_primary: boolean
        url?: string
        thumbnail_url?: string | null
      } = { sort_order: img.sortOrder, is_primary: img.isPrimary }
      const u = img.url.trim()
      if (u) {
        rowUpdate.url = u
        rowUpdate.thumbnail_url =
          typeof img.thumbnailUrl === "string" && img.thumbnailUrl.trim()
            ? img.thumbnailUrl.trim()
            : null
      }
      await supabase
        .from("listing_images")
        .update(rowUpdate)
        .eq("id", img.id)
        .eq("listing_id", listingId)
    } else if (img.url.trim()) {
      await supabase.from("listing_images").insert({
        listing_id: listingId,
        url: img.url.trim(),
        thumbnail_url:
          typeof img.thumbnailUrl === "string" && img.thumbnailUrl.trim()
            ? img.thumbnailUrl.trim()
            : null,
        is_primary: img.isPrimary,
        sort_order: img.sortOrder,
      })
    }
  }
}

export async function updateMagazineListing(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
  input: UpdateMagazineListingInput,
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
  if (existing.section !== MAGAZINES_SECTION) {
    throw new Error("Only magazine listings can be edited here")
  }
  if (existing.status === "sold") {
    throw new Error("Sold listings cannot be edited")
  }

  const updateFields = buildMagazineListingPersistFields(input)
  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update(updateFields)
    .eq("id", listingId)
    .eq("user_id", userId)
    .select("slug")
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to update magazine listing")
  }

  const imageOps: MagazineListingImageUpdateOp[] = input.images.map((img, index) => ({
    id: img.id,
    url: img.url,
    thumbnailUrl: img.thumbnailUrl ?? null,
    isPrimary: img.isPrimary ?? index === 0,
    sortOrder: img.sortOrder ?? index,
  }))

  await syncMagazineListingImages(
    supabase,
    listingId,
    input.removedImageIds ?? [],
    imageOps,
  )

  return { slug: (updated.slug as string) ?? (existing.slug as string) }
}

export async function createMagazineListing(
  supabase: SupabaseClient,
  userId: string,
  input: CreateMagazineListingInput,
): Promise<CreateMagazineListingResult> {
  const slug = await generateUniqueListingSlug(supabase, input.title)
  const persistFields = buildMagazineListingPersistFields(input)
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
    throw new Error(listingError?.message ?? "Failed to create magazine listing")
  }

  const listingId = inserted.id as string

  const imageRows = input.images.map((img, index) => ({
    listing_id: listingId,
    url: img.url,
    thumbnail_url: img.thumbnailUrl ?? null,
    is_primary: img.isPrimary ?? index === 0,
    sort_order: img.sortOrder ?? index,
  }))

  const { error: imageError } = await supabase.from("listing_images").insert(imageRows)
  if (imageError) {
    await supabase.from("listings").delete().eq("id", listingId)
    throw new Error(imageError.message)
  }

  return { listingId, slug: (inserted.slug as string) ?? slug }
}
