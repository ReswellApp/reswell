/**
 * Server-only: Klaviyo Events API — fires when an offer becomes ACCEPTED.
 *
 * **Metric name in Klaviyo:** `Offer Accepted` — profile is the **buyer** so flows can
 * email them to check out, then use a time delay for a “still available” reminder.
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → **Offer Accepted** →
 * send email immediately → Time delay (24h) → reminder email. Add a trigger filter or
 * flow filter to skip people who already fired **Placed Order** / **Purchase Successful**.
 *
 * Template variables include:
 * `{{ event.Title }}`, `{{ event.offer_amount_display }}`, `{{ event.list_price_display }}`,
 * `{{ event.offer_from.display_name }}`, `{{ event.fulfillment_label }}`,
 * `{{ event.listing_url }}`, `{{ event.checkout_url }}`, `{{ event.offers_url }}`,
 * `{{ event.messages_url }}`, `{{ event.photo_url }}`, `{{ event.accepted_by }}`.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
  klaviyoCommerceEventProperties,
  listingToKlaviyoEventCommerceItem,
  type KlaviyoListingImage,
} from "@/lib/klaviyo/catalog-product"
import { acceptedOfferCheckoutHref, listingDetailHref } from "@/lib/listing-href"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

function displayNameFromProfileRow(data: {
  display_name?: string | null
  shop_name?: string | null
  is_shop?: boolean | null
} | null): string {
  if (!data) return ""
  const shop = typeof data.shop_name === "string" ? data.shop_name.trim() : ""
  if (data.is_shop && shop) return shop
  const dn = typeof data.display_name === "string" ? data.display_name.trim() : ""
  return dn || "Seller"
}

async function getSellerOfferFromFields(sellerId: string): Promise<{
  email: string | null
  display_name: string
}> {
  const email = await getAuthEmailForUserId(sellerId)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { email, display_name: "" }
  }
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", sellerId)
      .maybeSingle()
    return { email, display_name: displayNameFromProfileRow(data) }
  } catch {
    return { email, display_name: "" }
  }
}

async function getListingImages(listingId: string): Promise<KlaviyoListingImage[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return []
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("listing_images")
      .select("url, thumbnail_url, is_primary, sort_order")
      .eq("listing_id", listingId)
    return (data ?? []) as KlaviyoListingImage[]
  } catch {
    return []
  }
}

function fulfillmentLabel(fulfillment: "pickup" | "shipping" | null): string {
  if (fulfillment === "pickup") return "Local pickup"
  if (fulfillment === "shipping") return "Shipping"
  return ""
}

export type KlaviyoOfferAcceptedPayload = {
  offerId: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listPrice: number
  offerAmount: number
  buyerUserId: string
  sellerUserId: string
  /** Who clicked accept — seller on a pending offer, buyer on a counter. */
  acceptedBy: "seller" | "buyer"
  fulfillment: "pickup" | "shipping" | null
  conversationId?: string | null
  listingImages?: KlaviyoListingImage[] | null
}

export async function trackKlaviyoOfferAccepted(
  payload: KlaviyoOfferAcceptedPayload,
): Promise<void> {
  const [buyerEmail, offerFrom, fetchedImages] = await Promise.all([
    getAuthEmailForUserId(payload.buyerUserId),
    getSellerOfferFromFields(payload.sellerUserId),
    payload.listingImages && payload.listingImages.length > 0
      ? Promise.resolve(payload.listingImages)
      : getListingImages(payload.listingId),
  ])

  const listPriceNum =
    typeof payload.listPrice === "number" ? payload.listPrice : Number(payload.listPrice)
  const offerAmountNum =
    typeof payload.offerAmount === "number" ? payload.offerAmount : Number(payload.offerAmount)

  const origin = publicSiteOriginForEmail()
  const path = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${path}`
  const checkoutUrl = `${origin}${acceptedOfferCheckoutHref(payload.offerId)}`
  const offersUrl = `${origin}/dashboard/offers?tab=buyer`
  const conversationId =
    typeof payload.conversationId === "string" ? payload.conversationId.trim() : ""
  const messagesUrl = conversationId
    ? `${origin}/messages/${conversationId}`
    : `${origin}/messages/new?user=${encodeURIComponent(payload.sellerUserId)}&listing=${encodeURIComponent(payload.listingId)}`

  const listingForCatalog = {
    id: payload.listingId,
    slug: payload.listingSlug,
    title: payload.listingTitle,
    price: payload.offerAmount,
    section: payload.listingSection,
    listing_images: fetchedImages,
  }

  const commerceItem = listingToKlaviyoEventCommerceItem(listingForCatalog)
  const photoUrl = absoluteKlaviyoListingImageUrl(listingForCatalog)
  const offerAmountDisplay = formatKlaviyoPriceDisplay(
    Number.isFinite(offerAmountNum) ? offerAmountNum : null,
  )
  const listPriceDisplay = formatKlaviyoPriceDisplay(
    Number.isFinite(listPriceNum) ? listPriceNum : null,
  )

  const result = await sendKlaviyoServerEvent({
    metricName: "Offer Accepted",
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      ...klaviyoCommerceEventProperties({
        primaryProductId: payload.listingId,
        items: [commerceItem],
      }),
      time: new Date().toISOString(),
      listing_id: payload.listingId,
      offer_id: payload.offerId,
      offer_amount: Number.isFinite(offerAmountNum)
        ? offerAmountNum
        : payload.offerAmount,
      offer_amount_display: offerAmountDisplay,
      list_price: Number.isFinite(listPriceNum) ? listPriceNum : payload.listPrice,
      list_price_display: listPriceDisplay,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      checkout_url: checkoutUrl,
      photo_url: photoUrl,
      offers_url: offersUrl,
      messages_url: messagesUrl,
      fulfillment: payload.fulfillment ?? "",
      fulfillment_label: fulfillmentLabel(payload.fulfillment),
      accepted_by: payload.acceptedBy,
      seller_display_name: offerFrom.display_name || "Seller",
      offer_from: {
        user_id: payload.sellerUserId,
        email: offerFrom.email ?? "",
        display_name: offerFrom.display_name,
      },
    },
    uniqueId: `offer-accepted-${payload.offerId}`,
    value: Number.isFinite(offerAmountNum) ? offerAmountNum : undefined,
    valueCurrency: "USD",
  })

  if (!result.ok && !result.skipped) {
    console.error(
      "[klaviyo] Offer Accepted event failed:",
      result.status,
      result.detail.slice(0, 300),
    )
  }
}
