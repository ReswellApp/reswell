/**
 * Fan-out Klaviyo **Followed Seller New Listing** to every follower when a seller
 * publishes. Klaviyo `uniqueId` is per follower+listing so duplicate publish paths are safe.
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoFollowedSellerNewListing } from "@/lib/klaviyo/track-followed-seller-new-listing"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sellerProfileHref } from "@/lib/seller-slug"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type NotifyFollowersNewListingKlaviyoResult = {
  followerCount: number
  emitted: number
  skippedEmailPref: number
  skippedReason?: string
}

function displayNameFromProfile(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return "Seller"
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Seller"
}

function listingPublicPath(listing: {
  id: string
  slug?: string | null
}): string {
  const slug = listing.slug?.trim()
  if (slug) return `/l/${encodeURIComponent(slug)}`
  return `/l/${listing.id}`
}

/**
 * When a peer listing goes live, email followers via Klaviyo (**Followed Seller New Listing**).
 * Respects `notification_preferences.follow_email_digest` (default on).
 */
export async function notifyFollowersNewListingKlaviyo(
  listingId: string,
): Promise<NotifyFollowersNewListingKlaviyoResult> {
  let service
  try {
    service = createServiceRoleClient()
  } catch {
    return { followerCount: 0, emitted: 0, skippedEmailPref: 0, skippedReason: "missing_service_role" }
  }

  const { data: listing, error: listingErr } = await service
    .from("listings")
    .select(
      "id, user_id, title, price, slug, section, status, hidden_from_site",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr || !listing) {
    return { followerCount: 0, emitted: 0, skippedEmailPref: 0, skippedReason: "listing_not_found" }
  }

  if (
    !isPeerListingSection(listing.section) ||
    listing.status !== "active" ||
    listing.hidden_from_site
  ) {
    return {
      followerCount: 0,
      emitted: 0,
      skippedEmailPref: 0,
      skippedReason: "listing_not_alertable",
    }
  }

  const sellerId = String(listing.user_id)

  const { data: follows, error: followErr } = await service
    .from("seller_follows")
    .select("follower_id")
    .eq("seller_id", sellerId)

  if (followErr) {
    console.error("[klaviyo] followed-seller listing: fetch follows:", followErr)
    return {
      followerCount: 0,
      emitted: 0,
      skippedEmailPref: 0,
      skippedReason: "fetch_follows_failed",
    }
  }

  const followerIds = (follows ?? [])
    .map((f) => f.follower_id)
    .filter((id): id is string => typeof id === "string" && id !== sellerId)

  if (followerIds.length === 0) {
    return { followerCount: 0, emitted: 0, skippedEmailPref: 0 }
  }

  const [{ data: seller }, { data: firstImage }, { data: prefRows }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, shop_name, is_shop, seller_slug")
      .eq("id", sellerId)
      .maybeSingle(),
    service
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    service
      .from("notification_preferences")
      .select("user_id, follow_email_digest")
      .in("user_id", followerIds),
  ])

  const emailOptOut = new Set(
    (prefRows ?? [])
      .filter((p) => p.follow_email_digest === false)
      .map((p) => p.user_id as string),
  )

  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const shopDisplayName = displayNameFromProfile(seller)
  const sellerSlug =
    typeof seller?.seller_slug === "string" ? seller.seller_slug.trim() : null
  const shopUrl = `${origin}${sellerProfileHref({ seller_slug: sellerSlug })}`
  const followingFeedUrl = `${origin}/following`
  const listingAbsoluteUrl = `${origin}${listingPublicPath(listing)}`
  const photoUrl =
    (firstImage?.thumbnail_url && String(firstImage.thumbnail_url).trim()) ||
    (firstImage?.url && String(firstImage.url).trim()) ||
    null
  const priceNum =
    typeof listing.price === "number" ? listing.price : Number(listing.price ?? NaN)

  let emitted = 0
  let skippedEmailPref = 0

  for (const followerId of followerIds) {
    if (emailOptOut.has(followerId)) {
      skippedEmailPref += 1
      continue
    }

    const email = await getAuthEmailForUserId(followerId)
    void trackKlaviyoFollowedSellerNewListing({
      followerUserId: followerId,
      followerEmail: email,
      sellerUserId: sellerId,
      sellerSlug,
      shopDisplayName,
      shopUrl,
      listingId: listing.id,
      listingTitle: String(listing.title ?? ""),
      listingPrice: Number.isFinite(priceNum) ? priceNum : 0,
      listingAbsoluteUrl,
      listingPhotoUrl: photoUrl,
      listingSection: typeof listing.section === "string" ? listing.section : null,
      followingFeedUrl,
    })
    emitted += 1
  }

  return { followerCount: followerIds.length, emitted, skippedEmailPref }
}
