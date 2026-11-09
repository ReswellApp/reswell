import type { SupabaseClient } from "@supabase/supabase-js"
import { listingDetailHref } from "@/lib/listing-href"
import {
  newListingBody,
  newListingDedupeKey,
  priceDropBody,
  priceDropDedupeKey,
  priceDropMeetsThreshold,
} from "@/lib/services/notifications/catalog"
import { publishInAppNotifications } from "@/lib/services/notifications/publish"
import type { InAppNotificationInput } from "@/lib/services/notifications/plan"

/**
 * Fan out a "new listing" notification to followers of a seller.
 *
 * Pass `followerIds` when the caller is already paging the follow list.
 * Caps live in the publisher: two individual rows per seller per day, eight
 * overall, then one digest row per seller.
 */
export async function notifyFollowersOfNewListing(
  supabase: SupabaseClient,
  params: {
    sellerId: string
    listingId: string
    listingTitle: string
    listingSlug?: string | null
    shopName?: string | null
    followerIds?: string[]
  },
) {
  const { sellerId, listingId, listingTitle, listingSlug, shopName, followerIds: followerIdsOverride } = params

  let followerIds: string[]
  if (followerIdsOverride) {
    followerIds = followerIdsOverride.filter((id) => id && id !== sellerId)
  } else {
    const { data: follows, error: followErr } = await supabase
      .from("seller_follows")
      .select("follower_id")
      .eq("seller_id", sellerId)

    if (followErr || !follows || follows.length === 0) return
    followerIds = follows.map((row) => row.follower_id).filter((id): id is string => typeof id === "string")
  }

  if (followerIds.length === 0) return

  const href = listingDetailHref({ id: listingId, slug: listingSlug })
  const inputs: InAppNotificationInput[] = followerIds.map((followerId) => ({
    userId: followerId,
    type: "new_listing_from_followed",
    actorId: sellerId,
    listingId,
    subjectKey: sellerId,
    digestActorName: shopName,
    title: "New listing",
    body: newListingBody(listingTitle),
    href,
    dedupeKey: newListingDedupeKey(listingId),
    metadata: { listingId, sellerId },
  }))

  await publishInAppNotifications(supabase, inputs)
}

/**
 * Notify followers who have also saved a listing when the price drops by at least 10%.
 * A second drop on the same listing updates the open row. After five listings in a
 * day, further listings wait until the next window.
 */
export async function notifyFollowersOfPriceDrop(
  supabase: SupabaseClient,
  params: {
    sellerId: string
    listingId: string
    listingTitle: string
    listingSlug?: string | null
    oldPrice: number
    newPrice: number
  },
) {
  const { sellerId, listingId, listingTitle, listingSlug, oldPrice, newPrice } = params
  if (!priceDropMeetsThreshold(oldPrice, newPrice)) return

  const { data: interestedFollowers } = await supabase
    .from("seller_follows")
    .select("follower_id")
    .eq("seller_id", sellerId)

  if (!interestedFollowers || interestedFollowers.length === 0) return

  const followerIds = interestedFollowers
    .map((row) => row.follower_id)
    .filter((id): id is string => typeof id === "string" && id !== sellerId)

  if (followerIds.length === 0) return

  const { data: savedByFollowers } = await supabase
    .from("favorites")
    .select("user_id")
    .eq("listing_id", listingId)
    .in("user_id", followerIds)

  if (!savedByFollowers || savedByFollowers.length === 0) return

  const href = listingDetailHref({ id: listingId, slug: listingSlug })
  const inputs: InAppNotificationInput[] = savedByFollowers.map((row) => ({
    userId: row.user_id as string,
    type: "price_drop_from_followed",
    actorId: sellerId,
    listingId,
    title: "Price drop",
    body: priceDropBody(listingTitle, oldPrice, newPrice),
    href,
    dedupeKey: priceDropDedupeKey(listingId),
    metadata: { listingId, oldPrice, newPrice },
  }))

  await publishInAppNotifications(supabase, inputs)
}
