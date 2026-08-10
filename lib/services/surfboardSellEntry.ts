import type { SupabaseClient } from "@supabase/supabase-js"
import { sellerHasAnyPublishedListing } from "@/lib/db/sellerFirstListing"
import {
  SURFBOARD_SELL_BOARDS_CREATE_HREF,
  SURFBOARD_SELL_QUICK_CREATE_HREF,
} from "@/lib/sell-flow/surfboard-sell-paths"

/**
 * Default surfboard create path:
 * - Guests and first-time publishers (no prior non-draft listing) → Quick List
 * - Returning publishers → Guided boards form
 */
export async function resolveDefaultSurfboardSellCreatePath(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string> {
  const uid = typeof userId === "string" ? userId.trim() : ""
  if (!uid) return SURFBOARD_SELL_QUICK_CREATE_HREF

  const hasPublished = await sellerHasAnyPublishedListing(supabase, uid)
  return hasPublished
    ? SURFBOARD_SELL_BOARDS_CREATE_HREF
    : SURFBOARD_SELL_QUICK_CREATE_HREF
}
