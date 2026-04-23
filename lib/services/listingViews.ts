import type { SupabaseClient } from "@supabase/supabase-js"
import { incrementListingViews } from "@/lib/db/listing-views"

/**
 * Records a view of a public listing detail page. Skips when the viewer is the
 * seller (enforced in DB).
 */
export async function recordPublicListingView(
  supabase: SupabaseClient,
  args: { listingId: string; viewerUserId: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  return incrementListingViews(supabase, args.listingId, args.viewerUserId)
}
