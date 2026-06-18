import type { SupabaseClient } from "@supabase/supabase-js"
import { incrementListingViews } from "@/lib/db/listing-views"
import { upsertUserRecentlyViewedListing } from "@/lib/db/navSearchPersonalization"

/**
 * Records a view of a public listing detail page. Skips when the viewer is the
 * seller (enforced in DB). Logged-in viewers also get the listing in nav
 * recently viewed personalization.
 */
export async function recordPublicListingView(
  supabase: SupabaseClient,
  args: { listingId: string; viewerUserId: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await incrementListingViews(
    supabase,
    args.listingId,
    args.viewerUserId,
  )

  if (result.ok && args.viewerUserId) {
    await upsertUserRecentlyViewedListing(
      supabase,
      args.viewerUserId,
      args.listingId,
    )
  }

  return result
}
