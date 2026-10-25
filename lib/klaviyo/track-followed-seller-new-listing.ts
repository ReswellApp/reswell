/**
 * Server-only: Klaviyo Events API — fires for each follower when a followed seller
 * publishes a new listing.
 *
 * **Metric name in Klaviyo:** `Followed Seller New Listing` — profile is the **follower**.
 *
 * **Building the flow:** Flows → Metric → **Followed Seller New Listing** → paste
 * `KLAVIYO_FOLLOWED_SELLER_NEW_LISTING_EMAIL_HTML` from
 * `followed-seller-new-listing-email-liquid.ts`. Event fields:
 * `{{ event.Title }}`, `{{ event.price_display }}`, `{{ event.Listing_URL }}`,
 * `{{ event.photo_url }}`, `{{ event.shop_display_name }}`, `{{ event.shop.url }}`,
 * `{{ event.following_feed_url }}`.
 *
 * Do not also fire `Board Alert Match` for shop follows — that metric is for saved
 * searches / model / brand alerts. Shop email is this metric only.
 */

import { absoluteKlaviyoListingPhotoUrl, formatKlaviyoPriceDisplay } from "@/lib/klaviyo/catalog-product"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoFollowedSellerNewListingPayload = {
  followerUserId: string
  followerEmail?: string | null
  sellerUserId: string
  sellerSlug?: string | null
  shopDisplayName: string
  shopUrl: string
  listingId: string
  listingTitle: string
  listingPrice: number
  listingAbsoluteUrl: string
  listingPhotoUrl: string | null
  listingSection?: string | null
  followingFeedUrl: string
}

export async function trackKlaviyoFollowedSellerNewListing(
  payload: KlaviyoFollowedSellerNewListingPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  let email = payload.followerEmail?.trim() || null
  if (!email) {
    email = await getAuthEmailForUserId(payload.followerUserId)
  }

  const priceNum =
    typeof payload.listingPrice === "number"
      ? payload.listingPrice
      : Number(payload.listingPrice)
  const price = Number.isFinite(priceNum) ? priceNum : null

  return sendKlaviyoServerEvent({
    metricName: "Followed Seller New Listing",
    profile: {
      external_id: payload.followerUserId,
      email,
    },
    uniqueId: `followed-seller-listing-${payload.followerUserId}-${payload.listingId}`,
    properties: {
      time: new Date().toISOString(),
      Listing_ID: payload.listingId,
      Title: payload.listingTitle,
      Price: price ?? payload.listingPrice,
      price_display: formatKlaviyoPriceDisplay(price),
      Listing_URL: payload.listingAbsoluteUrl,
      photo_url: payload.listingPhotoUrl
        ? absoluteKlaviyoListingPhotoUrl(payload.listingPhotoUrl)
        : "",
      Section: payload.listingSection ?? "",
      following_feed_url: payload.followingFeedUrl,
      shop_display_name: payload.shopDisplayName,
      shop: {
        user_id: payload.sellerUserId,
        display_name: payload.shopDisplayName,
        slug: payload.sellerSlug?.trim() ?? "",
        url: payload.shopUrl,
      },
    },
    value: price ?? undefined,
    valueCurrency: "USD",
  })
}
