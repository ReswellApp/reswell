import type { SupabaseClient } from "@supabase/supabase-js"

import { removeListingImageFilesFromStorage } from "@/lib/services/listingStorageCleanup"

/**
 * Deletes the video rows, then their storage objects.
 * Files stay put when the row delete fails.
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

  const ids = [...new Set(videoRowIds)]
  const { data: existing, error: existingErr } = await supabaseUser
    .from("listing_videos")
    .select("id")
    .eq("listing_id", listingId)
    .in("id", ids)

  if (existingErr) {
    return { ok: false, error: existingErr.message || "Could not remove this video" }
  }
  if (!existing?.length) return { ok: true }

  const { data: deleted, error: deleteErr } = await supabaseUser
    .from("listing_videos")
    .delete()
    .eq("listing_id", listingId)
    .in(
      "id",
      existing.map((row) => row.id),
    )
    .select("url, thumbnail_url")

  if (deleteErr) {
    return { ok: false, error: deleteErr.message || "Could not remove this video" }
  }
  if (!deleted?.length) {
    return { ok: false, error: "Could not remove this video" }
  }

  const urls: string[] = []
  for (const row of deleted) {
    if (row.url?.trim()) urls.push(row.url)
    if (row.thumbnail_url?.trim()) urls.push(row.thumbnail_url)
  }

  await removeListingImageFilesFromStorage(serviceSupabase, urls)
  return { ok: true }
}
