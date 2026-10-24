import type { SupabaseClient } from "@supabase/supabase-js"
import { listFollowInAppOptOutUserIds } from "@/lib/db/notifications"
import { listingDetailHref } from "@/lib/listing-href"
import {
  claimFollowedSellerNewListingAlerts,
  recipientsAllowedByListingAlertCap,
} from "@/lib/services/followedSellerNewListingAlert"
import {
  newListingBody,
  newListingDedupeKey,
  newListingTitle,
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
 * Email and in-app share one database cap: two listings per follower per
 * Pacific day, across every shop they follow. Past that, this sends nothing.
 * `follow_in_app` opt-out skips the row and does not take a slot.
 */
export async function notifyFollowersOfNewListing(
  supabase: SupabaseClient,
  params: {
    sellerId: string
    listingId: string
    listingTitle: string
    listingSlug?: string | null
    listingPrice?: number | string | null
    shopName?: string | null
    followerIds?: string[]
  },
) {
  const {
    sellerId,
    listingId,
    listingTitle,
    listingSlug,
    listingPrice,
    shopName,
    followerIds: followerIdsOverride,
  } = params

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

  const optedOut = new Set(await listFollowInAppOptOutUserIds(supabase, followerIds))
  const eligibleIds = followerIds.filter((id) => !optedOut.has(id))
  const claims = await claimFollowedSellerNewListingAlerts(supabase, {
    listingId,
    recipientIds: eligibleIds,
  })
  const allowed = recipientsAllowedByListingAlertCap(claims)
  if (allowed.size === 0) return

  const price = finiteListingPrice(listingPrice)
  const href = listingDetailHref({ id: listingId, slug: listingSlug })
  const inputs: InAppNotificationInput[] = followerIds
    .filter((followerId) => allowed.has(followerId))
    .map((followerId) => ({
      userId: followerId,
      type: "new_listing_from_followed",
      actorId: sellerId,
      listingId,
      subjectKey: sellerId,
      title: newListingTitle(shopName),
      body: newListingBody(shopName, listingTitle, price),
      href,
      dedupeKey: newListingDedupeKey(listingId),
      metadata: {
        listingId,
        sellerId,
        shopName: shopName?.trim() || null,
        ...(price != null ? { price } : {}),
      },
    }))

  await publishInAppNotifications(supabase, inputs)
}

function finiteListingPrice(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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
