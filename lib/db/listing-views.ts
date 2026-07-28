import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Calls RPC that increments public.listings.views (RLS blocks direct client updates).
 * `counted` is false for seller self-views and non-countable listing statuses.
 */
export async function incrementListingViews(
  supabase: SupabaseClient,
  listingId: string,
  viewerUserId: string | null,
): Promise<{ ok: true; counted: boolean } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("increment_listing_views", {
    p_listing_id: listingId,
    p_viewer_id: viewerUserId,
  })
  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true, counted: data === true }
}
