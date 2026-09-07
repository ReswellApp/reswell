/**
 * Orchestrates Klaviyo metrics when a buyer follows a seller/shop.
 * Best-effort — never throws to the follow action.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoFollowingShop } from "@/lib/klaviyo/track-following-shop"
import { trackKlaviyoShopFollowed } from "@/lib/klaviyo/track-shop-followed"
import { createServiceRoleClient } from "@/lib/supabase/server"

function displayNameFromProfile(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn
}

export type NotifyShopFollowKlaviyoInput = {
  followId: string
  followedAt: string
  sellerUserId: string
  followerUserId: string
  followerEmail?: string | null
  isBackfill?: boolean
}

/**
 * Emits **Shop Followed** (seller profile) + **Following Shop** (follower profile).
 */
export async function notifyShopFollowKlaviyo(
  input: NotifyShopFollowKlaviyoInput,
): Promise<void> {
  let admin
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error(
      "[klaviyo] shop follow: missing service role:",
      e instanceof Error ? e.message : e,
    )
    return
  }

  const [{ data: seller }, { data: follower }, sellerEmail, followerEmailResolved] =
    await Promise.all([
      admin
        .from("profiles")
        .select("display_name, shop_name, is_shop, seller_slug")
        .eq("id", input.sellerUserId)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name, shop_name, is_shop")
        .eq("id", input.followerUserId)
        .maybeSingle(),
      getAuthEmailForUserId(input.sellerUserId),
      input.followerEmail?.trim()
        ? Promise.resolve(input.followerEmail.trim())
        : getAuthEmailForUserId(input.followerUserId),
    ])

  const shopDisplayName = displayNameFromProfile(seller) || "Shop"
  const followerDisplayName = displayNameFromProfile(follower) || "Someone"
  const sellerSlug =
    typeof seller?.seller_slug === "string" ? seller.seller_slug.trim() : null

  const common = {
    followId: input.followId,
    followedAt: input.followedAt,
    sellerUserId: input.sellerUserId,
    sellerSlug,
    shopDisplayName,
    isBackfill: input.isBackfill === true,
  }

  const [sellerResult, followerResult] = await Promise.all([
    trackKlaviyoShopFollowed({
      ...common,
      sellerEmail,
      followerUserId: input.followerUserId,
      followerEmail: followerEmailResolved,
      followerDisplayName,
    }),
    trackKlaviyoFollowingShop({
      ...common,
      followerUserId: input.followerUserId,
      followerEmail: followerEmailResolved,
    }),
  ])

  if (!sellerResult.ok && !sellerResult.skipped) {
    console.error(
      "[klaviyo] Shop Followed failed:",
      sellerResult.status,
      sellerResult.detail.slice(0, 300),
    )
  }
  if (!followerResult.ok && !followerResult.skipped) {
    console.error(
      "[klaviyo] Following Shop failed:",
      followerResult.status,
      followerResult.detail.slice(0, 300),
    )
  }
}
