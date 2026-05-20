/**
 * Server-only: Klaviyo Events API — fires when a buyer saves a listing to their cart.
 * Metric name in Klaviyo: **"Added to Cart"** (use as the flow trigger).
 * Includes **ProductID** + **Items** for Klaviyo product blocks (catalog $id must match listing UUID).
 */

import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import {
  klaviyoCommerceEventProperties,
  listingToKlaviyoEventCommerceItem,
} from "@/lib/klaviyo/catalog-product"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoAddedToCartPayload = {
  buyerUserId: string
  buyerEmail: string | null
  listingId: string
  title: string
  price: number
  slug: string | null
  section: string
  photoUrl: string | null
}

export async function trackKlaviyoAddedToCart(
  payload: KlaviyoAddedToCartPayload,
): Promise<void> {
  const priceNum =
    typeof payload.price === "number" ? payload.price : Number(payload.price)
  const origin = publicSiteOrigin()
  const path = listingDetailHref({
    id: payload.listingId,
    slug: payload.slug ?? undefined,
    section: payload.section,
  })
  const listingUrl = `${origin}${path}`
  const checkoutParam = payload.slug?.trim() || payload.listingId
  const checkoutPath = peerListingCheckoutHref(
    payload.section,
    checkoutParam,
  )
  const checkoutUrl = `${origin}${checkoutPath}`

  const commerceItem = listingToKlaviyoEventCommerceItem({
    id: payload.listingId,
    slug: payload.slug,
    title: payload.title,
    price: payload.price,
    section: payload.section,
    listing_images: payload.photoUrl
      ? [{ url: payload.photoUrl, is_primary: true }]
      : null,
  })

  await sendKlaviyoServerEvent({
    metricName: "Added to Cart",
    properties: {
      ...klaviyoCommerceEventProperties({
        primaryProductId: payload.listingId,
        items: [commerceItem],
      }),
      listing_id: payload.listingId,
      Title: payload.title,
      Price: Number.isFinite(priceNum) ? priceNum : payload.price,
      photo_url: payload.photoUrl ?? "",
      listing_url: listingUrl,
      checkout_url: checkoutUrl,
    },
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
    },
    uniqueId: `cart-add-${payload.buyerUserId}-${payload.listingId}-${Date.now()}`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
  })
}
