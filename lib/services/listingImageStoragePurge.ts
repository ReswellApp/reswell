import type { SupabaseClient } from "@supabase/supabase-js"

import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

/**
 * Deletes the photo rows, then their storage objects.
 * Files stay put when the row delete fails, so a listing cannot keep pointing
 * at a thumb that has already been removed.
 */
export async function purgeListingImageStorageForRowIds(
  supabaseUser: SupabaseClient,
  serviceSupabase: SupabaseClient,
  listingOwnerUserId: string,
  listingId: string,
  imageRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (imageRowIds.length === 0) return { ok: true }

  const { data: listing, error: listingErr } = await supabaseUser
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing || listing.user_id !== listingOwnerUserId) {
    return { ok: false, error: "Forbidden" }
  }

  const ids = [...new Set(imageRowIds)]
  const { data: existing, error: existingErr } = await supabaseUser
    .from("listing_images")
    .select("id")
    .eq("listing_id", listingId)
    .in("id", ids)

  if (existingErr) {
    return { ok: false, error: existingErr.message || "Could not remove these photos" }
  }
  if (!existing?.length) return { ok: true }

  const { data: deleted, error: deleteErr } = await supabaseUser
    .from("listing_images")
    .delete()
    .eq("listing_id", listingId)
    .in(
      "id",
      existing.map((row) => row.id),
    )
    .select("url, thumbnail_url")

  if (deleteErr) {
    return { ok: false, error: deleteErr.message || "Could not remove these photos" }
  }
  if (!deleted?.length) {
    return { ok: false, error: "Could not remove these photos" }
  }

  const urls: string[] = []
  for (const row of deleted) {
    if (row.url?.trim()) urls.push(row.url)
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url)
  }

  await removeListingImageFilesFromStorage(serviceSupabase, urls)
  return { ok: true }
}
