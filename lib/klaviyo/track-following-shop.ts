/**
 * Server-only: Klaviyo Events API — fires on the **follower** profile when they follow a shop.
 *
 * **Metric name in Klaviyo:** `Following Shop` — used to enter follower emails into Klaviyo
 * (live follows + historical backfill). Optional welcome flow; filter `is_backfill` ≠ true
 * if you only want live follows.
 *
 * Profile = follower (`external_id` = Supabase user id). Shop details live under `shop`.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sellerProfileHref } from "@/lib/seller-slug"

export type KlaviyoFollowingShopPayload = {
  followId: string
  followedAt: string
  followerUserId: string
  followerEmail?: string | null
  sellerUserId: string
  sellerSlug?: string | null
  shopDisplayName: string
  isBackfill?: boolean
}

export async function trackKlaviyoFollowingShop(
  payload: KlaviyoFollowingShopPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  let followerEmail = payload.followerEmail?.trim() || null
  if (!followerEmail) {
    followerEmail = await getAuthEmailForUserId(payload.followerUserId)
  }

  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const shopPath = sellerProfileHref({ seller_slug: payload.sellerSlug ?? null })
  const shopUrl = `${origin}${shopPath}`
  const followingFeedUrl = `${origin}/following`

  return sendKlaviyoServerEvent({
    metricName: "Following Shop",
    profile: {
      external_id: payload.followerUserId,
      email: followerEmail,
    },
    uniqueId: payload.isBackfill
      ? `following-shop-backfill-${payload.followId}`
      : `following-shop-${payload.followId}`,
    properties: {
      time: payload.followedAt,
      follow_id: payload.followId,
      is_backfill: payload.isBackfill === true,
      following_feed_url: followingFeedUrl,
      shop: {
        user_id: payload.sellerUserId,
        display_name: payload.shopDisplayName,
        slug: payload.sellerSlug?.trim() ?? "",
        url: shopUrl,
      },
    },
  })
}
