import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchCartProfileIdsForListing } from "@/lib/db/cartKlaviyo"
import {
  fetchFavoriteUserIdsForListing,
  fetchListingForKlaviyoFavoriteEvent,
  isFavoriteListingEligibleForKlaviyoCommerce,
} from "@/lib/db/favoritesKlaviyo"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  trackKlaviyoFavoritePriceDrop,
  type KlaviyoListingPriceDropInterestSource,
} from "@/lib/klaviyo/track-favorite-price-drop"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type NotifyKlaviyoFavoritePriceDropResult = {
  favoriterCount: number
  cartCount: number
  recipientCount: number
  emitted: number
  skipped: number
  failed: number
}

type ListingPriceDropRecipient = {
  buyerUserId: string
  interestSources: KlaviyoListingPriceDropInterestSource[]
}

function buildListingPriceDropRecipients(
  favoriterIds: string[],
  cartProfileIds: string[],
  sellerUserId: string | null,
): ListingPriceDropRecipient[] {
  const byUser = new Map<string, Set<KlaviyoListingPriceDropInterestSource>>()

  for (const userId of favoriterIds) {
    if (sellerUserId && userId === sellerUserId) continue
    const sources = byUser.get(userId) ?? new Set<KlaviyoListingPriceDropInterestSource>()
    sources.add("favorite")
    byUser.set(userId, sources)
  }

  for (const userId of cartProfileIds) {
    if (sellerUserId && userId === sellerUserId) continue
    const sources = byUser.get(userId) ?? new Set<KlaviyoListingPriceDropInterestSource>()
    sources.add("cart")
    byUser.set(userId, sources)
  }

  return [...byUser.entries()].map(([buyerUserId, sources]) => ({
    buyerUserId,
    interestSources: [...sources],
  }))
}

/**
 * Emits **Favorite Price Drop** for buyers who saved this listing (favorites and/or cart)
 * when list price decreases. Uses the service role — seller sessions cannot read other
 * users' favorites or cart rows.
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
    return {
      favoriterCount: 0,
      cartCount: 0,
      recipientCount: 0,
      emitted: 0,
      skipped: 0,
      failed: 0,
    }
  }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch {
    return {
      favoriterCount: 0,
      cartCount: 0,
      recipientCount: 0,
      emitted: 0,
      skipped: 0,
      failed: 0,
    }
  }

  const listing = await fetchListingForKlaviyoFavoriteEvent(admin, listingId)
  if (!listing || !isFavoriteListingEligibleForKlaviyoCommerce(listing)) {
    return {
      favoriterCount: 0,
      cartCount: 0,
      recipientCount: 0,
      emitted: 0,
      skipped: 0,
      failed: 0,
    }
  }

  const [favoriterIds, cartProfileIds] = await Promise.all([
    fetchFavoriteUserIdsForListing(admin, listingId),
    fetchCartProfileIdsForListing(admin, listingId),
  ])

  const sellerUserId =
    typeof listing.user_id === "string" && listing.user_id.trim()
      ? listing.user_id.trim()
      : null

  const recipients = buildListingPriceDropRecipients(
    favoriterIds,
    cartProfileIds,
    sellerUserId,
  )

  if (recipients.length === 0) {
    return {
      favoriterCount: favoriterIds.length,
      cartCount: cartProfileIds.length,
      recipientCount: 0,
      emitted: 0,
      skipped: 0,
      failed: 0,
    }
  }

  let emitted = 0
  let skipped = 0
  let failed = 0

  for (const recipient of recipients) {
    const email = await getAuthEmailForUserId(recipient.buyerUserId)
    const result = await trackKlaviyoFavoritePriceDrop({
      buyerUserId: recipient.buyerUserId,
      buyerEmail: email,
      listing,
      oldPriceUsd,
      newPriceUsd,
      interestSources: recipient.interestSources,
    })

    if (result.ok) emitted += 1
    else if (result.skipped) skipped += 1
    else failed += 1
  }

  return {
    favoriterCount: favoriterIds.length,
    cartCount: cartProfileIds.length,
    recipientCount: recipients.length,
    emitted,
    skipped,
    failed,
  }
}
