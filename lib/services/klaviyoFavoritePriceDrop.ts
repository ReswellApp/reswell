import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  fetchFavoriteUserIdsForListing,
  fetchListingForKlaviyoFavoriteEvent,
  isFavoriteListingEligibleForKlaviyoCommerce,
} from "@/lib/db/favoritesKlaviyo"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoFavoritePriceDrop } from "@/lib/klaviyo/track-favorite-price-drop"

export type NotifyKlaviyoFavoritePriceDropResult = {
  favoriterCount: number
  emitted: number
  skipped: number
  failed: number
}

/**
 * Emits **Favorite Price Drop** for every user who saved this listing when list price decreases.
 * Uses the service role to read favoriter rows (seller session cannot see other users' favorites).
 */
export async function notifyKlaviyoFavoritePriceDrop(
  _supabase: SupabaseClient,
  params: {
    listingId: string
    oldPriceUsd: number
    newPriceUsd: number
  },
): Promise<NotifyKlaviyoFavoritePriceDropResult> {
  const { listingId, oldPriceUsd, newPriceUsd } = params

  if (!(newPriceUsd < oldPriceUsd)) {
    return { favoriterCount: 0, emitted: 0, skipped: 0, failed: 0 }
  }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return { favoriterCount: 0, emitted: 0, skipped: 0, failed: 0 }
  }

  const listing = await fetchListingForKlaviyoFavoriteEvent(admin, listingId)
  if (!listing || !isFavoriteListingEligibleForKlaviyoCommerce(listing)) {
    return { favoriterCount: 0, emitted: 0, skipped: 0, failed: 0 }
  }

  const favoriterIds = await fetchFavoriteUserIdsForListing(admin, listingId)
  if (favoriterIds.length === 0) {
    return { favoriterCount: 0, emitted: 0, skipped: 0, failed: 0 }
  }

  let emitted = 0
  let skipped = 0
  let failed = 0

  for (const buyerUserId of favoriterIds) {
    const email = await getAuthEmailForUserId(buyerUserId)
    const result = await trackKlaviyoFavoritePriceDrop({
      buyerUserId,
      buyerEmail: email,
      listing,
      oldPriceUsd,
      newPriceUsd,
    })

    if (result.ok) emitted += 1
    else if (result.skipped) skipped += 1
    else failed += 1
  }

  return {
    favoriterCount: favoriterIds.length,
    emitted,
    skipped,
    failed,
  }
}
