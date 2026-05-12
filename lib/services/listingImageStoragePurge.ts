import type { SupabaseClient } from "@supabase/supabase-js"

import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

/**
 * After verifying the listing belongs to `listingOwnerUserId`, loads image row URLs
 * and removes matching objects from the listings bucket. Call before deleting
 * `listing_images` rows so storage does not retain orphaned primary/thumbnail files.
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

  const { data: rows, error: rowsErr } = await supabaseUser
    .from("listing_images")
    .select("id, url, thumbnail_url")
    .eq("listing_id", listingId)
    .in("id", imageRowIds)

  if (rowsErr || !rows || rows.length !== imageRowIds.length) {
    return { ok: false, error: "Images not found" }
  }

  const urls: string[] = []
  for (const r of rows) {
    if (r.url?.trim()) urls.push(r.url)
    if (r.thumbnail_url?.trim()) urls.push(r.thumbnail_url)
  }

  await removeListingImageFilesFromStorage(serviceSupabase, urls)
  return { ok: true }
}
