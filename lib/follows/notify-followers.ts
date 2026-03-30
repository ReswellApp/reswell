import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fan out a "new listing" notification to all followers of a seller.
 *
 * Call this AFTER a new listing is successfully inserted.
 * Uses the caller's Supabase client (must have INSERT on notifications via
 * the `notifications_service_insert` RLS policy).
 *
 * For sellers with 1000+ followers, move this to an Inngest/BullMQ job
 * to avoid blocking the listing-creation request.
 */
export async function notifyFollowersOfNewListing(
  supabase: SupabaseClient,
  params: {
    sellerId: string
    listingId: string
    listingTitle: string
  }
) {
  const { sellerId, listingId, listingTitle } = params

  // Get all follower IDs
  const { data: follows, error: followErr } = await supabase
    .from('seller_follows')
    .select('follower_id')
    .eq('seller_id', sellerId)

  if (followErr || !follows || follows.length === 0) return

  // Fan out notifications in a single batch insert
  const notifications = follows.map((f) => ({
    user_id: f.follower_id,
    type: 'new_listing_from_followed' as const,
    listing_id: listingId,
    actor_id: sellerId,
    message: `New listing: ${listingTitle}`,
  }))

  await supabase.from('notifications').insert(notifications)
}

/**
 * Notify followers who have also saved a listing when the price drops by ≥ 10%.
 */
export async function notifyFollowersOfPriceDrop(
  supabase: SupabaseClient,
  params: {
    sellerId: string
    listingId: string
    listingTitle: string
    oldPrice: number
    newPrice: number
  }
) {
  const { sellerId, listingId, listingTitle, oldPrice, newPrice } = params

  const dropPct = (oldPrice - newPrice) / oldPrice
  if (dropPct < 0.1) return // less than 10% drop — skip

  // Find followers who have also favorited/saved this listing
  const { data: interestedFollowers } = await supabase
    .from('seller_follows')
    .select('follower_id')
    .eq('seller_id', sellerId)

  if (!interestedFollowers || interestedFollowers.length === 0) return

  const followerIds = interestedFollowers.map((f) => f.follower_id)

  const { data: savedByFollowers } = await supabase
    .from('favorites')
    .select('user_id')
    .eq('listing_id', listingId)
    .in('user_id', followerIds)

  if (!savedByFollowers || savedByFollowers.length === 0) return

  const priceDiffStr = `$${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)}`
  const notifications = savedByFollowers.map((f) => ({
    user_id: f.user_id,
    type: 'price_drop_from_followed' as const,
    listing_id: listingId,
    actor_id: sellerId,
    message: `Price drop on "${listingTitle}" — ${priceDiffStr}`,
  }))

  await supabase.from('notifications').insert(notifications)
}
