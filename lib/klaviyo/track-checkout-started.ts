/**
 * Server-only: Klaviyo Events API — fires when a buyer lands on checkout with items ready to purchase.
 * Metric name in Klaviyo: **"Checkout Started"** (use as the flow trigger for abandoned checkout).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { primaryListingImageUrl } from "@/lib/listing-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoCheckoutStartedListing = {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
  price: string | number
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
  listing_images?: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null
}

export type KlaviyoCheckoutStartedPayload = {
  buyerUserId: string
  buyerEmail: string | null
  listings: KlaviyoCheckoutStartedListing[]
  checkoutPath: string
  fromCart: boolean
  sellerId?: string | null
}

function primaryPhotoUrl(listing: KlaviyoCheckoutStartedListing): string | null {
  const images = listing.listing_images ?? null
  const normalized = images?.map((image) => ({
    url: image.url,
    is_primary: image.is_primary ?? undefined,
  }))
  const primary = primaryListingImageUrl(normalized)
  if (primary?.trim()) return primary.trim()
  const first = images?.[0]
  const thumb = first?.thumbnail_url?.trim()
  if (thumb) return thumb
  const url = first?.url?.trim()
  return url || null
}

function estimateCheckoutTotal(listings: KlaviyoCheckoutStartedListing[]): number {
  const bundlePickupOnly = listings.length > 1
  if (bundlePickupOnly) {
    let sum = 0
    for (const listing of listings) {
      const resolved = resolvePayableAmount(listing, "pickup")
      if (resolved.ok) sum += resolved.total
    }
    return sum
  }

  const primary = listings[0]
  if (!primary) return 0

  const localPickup = primary.local_pickup !== false
  const shippingAvailable = !!primary.shipping_available
  const fulfillment =
    localPickup && shippingAvailable
      ? "pickup"
      : !localPickup && shippingAvailable
        ? "shipping"
        : "pickup"
  const resolved = resolvePayableAmount(primary, fulfillment)
  return resolved.ok ? resolved.total : 0
}

export async function trackKlaviyoCheckoutStarted(
  payload: KlaviyoCheckoutStartedPayload,
): Promise<void> {
  const primary = payload.listings[0]
  if (!primary) return

  const origin = publicSiteOrigin()
  const checkoutPath = payload.checkoutPath.startsWith("/")
    ? payload.checkoutPath
    : `/${payload.checkoutPath}`
  const checkoutUrl = `${origin}${checkoutPath}`
  const listingPath = listingDetailHref({
    id: primary.id,
    slug: primary.slug ?? undefined,
    section: primary.section,
  })
  const listingUrl = `${origin}${listingPath}`

  const itemCount = payload.listings.length
  const total = estimateCheckoutTotal(payload.listings)

  await sendKlaviyoServerEvent({
    metricName: "Checkout Started",
    properties: {
      listing_id: primary.id,
      Title: itemCount > 1 ? `${itemCount} boards` : String(primary.title ?? ""),
      item_count: itemCount,
      from_cart: payload.fromCart,
      seller_id: payload.sellerId ?? primary.user_id,
      photo_url: primaryPhotoUrl(primary) ?? "",
      listing_url: listingUrl,
      checkout_url: checkoutUrl,
      listing_ids: payload.listings.map((listing) => listing.id).join(","),
    },
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
    },
    uniqueId: `checkout-started-${payload.buyerUserId}-${primary.id}-${Date.now()}`,
    value: total > 0 ? total : undefined,
    valueCurrency: "USD",
  })
}
