import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isTransientNetworkError,
  retryOnTransientNetworkError,
} from "@/lib/utils/transient-network-retry"

/** Distinct users who saved this listing (one row per user per listing). */
export async function getListingFavoriteCount(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number> {
  const { data, error } = await retryOnTransientNetworkError(() =>
    supabase.rpc("count_listing_favorites", {
      p_listing_id: listingId,
    }),
  )
  if (error) {
    if (isTransientNetworkError(error.message)) {
      console.warn(
        `count_listing_favorites: transient network failure, showing 0: ${error.message}`,
      )
    } else {
      console.error("count_listing_favorites:", error.message)
    }
    return 0
  }
  if (data == null) return 0
  return typeof data === "number" ? data : Number(data) || 0
}
