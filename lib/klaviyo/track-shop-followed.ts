/**
 * Server-only: Klaviyo Events API — fires when someone follows a seller/shop.
 *
 * **Metric name in Klaviyo:** `Shop Followed` — profile is the **seller** so flows can
 * email them (“someone followed your shop”).
 *
 * Nested `followed_by` holds the follower (same pattern as **Favorites button** /
 * `favorited_by`) so Klaviyo does not mis-attach the follower’s email to the seller.
 *
 * **Building the flow:** Flows → Metric → **Shop Followed** → filter `is_backfill` ≠ true
 * (backfill sets `is_backfill: true` so historical follows do not spam sellers) → email with
 * `{{ event.followed_by.display_name }}`, `{{ event.shop_url }}`, `{{ event.followers_url }}`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sellerProfileHref } from "@/lib/seller-slug"

export type KlaviyoShopFollowedPayload = {
  followId: string
  followedAt: string
  sellerUserId: string
  sellerEmail?: string | null
  sellerSlug?: string | null
  shopDisplayName: string
  followerUserId: string
  followerEmail?: string | null
  followerDisplayName: string
  /** Historical backfill — flows should exclude these from live email. */
  isBackfill?: boolean
}

export async function trackKlaviyoShopFollowed(
  payload: KlaviyoShopFollowedPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  let sellerEmail = payload.sellerEmail?.trim() || null
  if (!sellerEmail) {
    sellerEmail = await getAuthEmailForUserId(payload.sellerUserId)
  }

  let followerEmail = payload.followerEmail?.trim() || null
  if (!followerEmail) {
    followerEmail = await getAuthEmailForUserId(payload.followerUserId)
  }

  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const shopPath = sellerProfileHref({ seller_slug: payload.sellerSlug ?? null })
  const shopUrl = `${origin}${shopPath}`
  const followersUrl = `${origin}/dashboard/following`

  return sendKlaviyoServerEvent({
    metricName: "Shop Followed",
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: payload.isBackfill
      ? `shop-followed-backfill-${payload.followId}`
      : `shop-followed-${payload.followId}`,
    properties: {
      time: payload.followedAt,
      follow_id: payload.followId,
      is_backfill: payload.isBackfill === true,
      shop_name: payload.shopDisplayName,
      shop_url: shopUrl,
      followers_url: followersUrl,
      seller_user_id: payload.sellerUserId,
      followed_by: {
        user_id: payload.followerUserId,
        display_name: payload.followerDisplayName || "Someone",
        email: followerEmail ?? "",
      },
    },
  })
}
