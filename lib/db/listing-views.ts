import type { SupabaseClient } from "@supabase/supabase-js"

/** Calls RPC that increments public.listings.views (RLS blocks direct client updates). */
export async function incrementListingViews(
  supabase: SupabaseClient,
  listingId: string,
  viewerUserId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("increment_listing_views", {
    p_listing_id: listingId,
    p_viewer_id: viewerUserId,
  })
  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true }
}
