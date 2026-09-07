import type { SupabaseClient } from "@supabase/supabase-js"

import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

/**
 * After verifying the listing belongs to `listingOwnerUserId`, loads video row URLs
 * and removes matching objects from the listings bucket. Call before deleting
 * `listing_videos` rows so storage does not retain orphaned video/poster files.
 */
export async function purgeListingVideoStorageForRowIds(
  supabaseUser: SupabaseClient,
  serviceSupabase: SupabaseClient,
  listingOwnerUserId: string,
  listingId: string,
  videoRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (videoRowIds.length === 0) return { ok: true }

  const { data: listing, error: listingErr } = await supabaseUser
    .from("listings")
    .select("user_id")
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing || listing.user_id !== listingOwnerUserId) {
    return { ok: false, error: "Forbidden" }
  }

  const { data: rows, error: rowsErr } = await supabaseUser
    .from("listing_videos")
    .select("id, url, thumbnail_url")
    .eq("listing_id", listingId)
    .in("id", videoRowIds)

  if (rowsErr || !rows || rows.length !== videoRowIds.length) {
    return { ok: false, error: "Videos not found" }
  }

  const urls: string[] = []
  for (const r of rows) {
    if (r.url?.trim()) urls.push(r.url)
    if (r.thumbnail_url?.trim()) urls.push(r.thumbnail_url)
  }

  await removeListingImageFilesFromStorage(serviceSupabase, urls)
  return { ok: true }
}
