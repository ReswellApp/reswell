/**
 * Server-only: Klaviyo Events API — fires when a buyer submits an offer on a listing.
 *
 * **Metric name in Klaviyo:** `Offer Made` — profile is the **seller** so flows can email them.
 * Buyer details live under `offer_from` (nested) to avoid Klaviyo mis-attaching scalar email props.
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Offer Made** →
 * email the profile on the event (seller). Template variables include:
 * `{{ event.Title }}`, `{{ event.offer_amount_display }}`, `{{ event.list_price_display }}`,
 * `{{ event.offer_from.display_name }}`, `{{ event.offer_note }}`, `{{ event.fulfillment_label }}`,
 * `{{ event.listing_url }}`, `{{ event.offers_url }}`, `{{ event.messages_url }}`, `{{ event.photo_url }}`.
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
import { listingDetailHref } from "@/lib/listing-href"
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
  return dn || "Buyer"
}

async function getBuyerOfferFromFields(buyerId: string): Promise<{
  email: string | null
  display_name: string
}> {
  const email = await getAuthEmailForUserId(buyerId)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { email, display_name: "" }
  }
  try {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", buyerId)
      .maybeSingle()
    return { email, display_name: displayNameFromProfileRow(data) }
  } catch {
    return { email, display_name: "" }
  }
}

function fulfillmentLabel(input: {
  fulfillment: "pickup" | "shipping"
  shippingRegion?: string | null
  shipZip?: string | null
}): string {
  if (input.fulfillment === "pickup") return "Local pickup"
  const regionLabels: Record<string, string> = {
    continental: "Continental US",
    alaska_hawaii: "Alaska / Hawaii",
    international: "International",
  }
  const region =
    input.shippingRegion && input.shippingRegion in regionLabels
      ? regionLabels[input.shippingRegion]
      : "Shipping"
  const zip = typeof input.shipZip === "string" ? input.shipZip.trim() : ""
  return zip ? `${region} · ZIP ${zip}` : region
}

export type KlaviyoOfferMadePayload = {
  offerId: string
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listPrice: number
  offerAmount: number
  buyerUserId: string
  sellerUserId: string
  offerNote?: string | null
  fulfillment: "pickup" | "shipping"
  shippingRegion?: string | null
  shipZip?: string | null
  conversationId?: string | null
  listingImages?: KlaviyoListingImage[] | null
}

export async function trackKlaviyoOfferMade(
  payload: KlaviyoOfferMadePayload,
): Promise<void> {
  const [sellerEmail, offerFrom] = await Promise.all([
    getAuthEmailForUserId(payload.sellerUserId),
    getBuyerOfferFromFields(payload.buyerUserId),
  ])

  const listPriceNum =
    typeof payload.listPrice === "number"
      ? payload.listPrice
      : Number(payload.listPrice)
  const offerAmountNum =
    typeof payload.offerAmount === "number"
      ? payload.offerAmount
      : Number(payload.offerAmount)

  const origin = publicSiteOriginForEmail()
  const path = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${path}`
  const offersUrl = `${origin}/dashboard/offers?tab=received`
  const conversationId =
    typeof payload.conversationId === "string" ? payload.conversationId.trim() : ""
  const messagesUrl = conversationId
    ? `${origin}/messages/${conversationId}`
    : `${origin}/messages/new?user=${encodeURIComponent(payload.buyerUserId)}&listing=${encodeURIComponent(payload.listingId)}`

  const note =
    typeof payload.offerNote === "string" && payload.offerNote.trim() !== ""
      ? payload.offerNote.trim().slice(0, 500)
      : null

  const listingForCatalog = {
    id: payload.listingId,
    slug: payload.listingSlug,
    title: payload.listingTitle,
    price: payload.listPrice,
    section: payload.listingSection,
    listing_images: payload.listingImages ?? null,
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
    metricName: "Offer Made",
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
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
      list_price: Number.isFinite(listPriceNum)
        ? listPriceNum
        : payload.listPrice,
      list_price_display: listPriceDisplay,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      photo_url: photoUrl,
      offers_url: offersUrl,
      messages_url: messagesUrl,
      offer_note: note ?? "",
      fulfillment: payload.fulfillment,
      fulfillment_label: fulfillmentLabel({
        fulfillment: payload.fulfillment,
        shippingRegion: payload.shippingRegion,
        shipZip: payload.shipZip,
      }),
      shipping_region: payload.shippingRegion ?? "",
      ship_zip: payload.shipZip ?? "",
      buyer_display_name: offerFrom.display_name || "Buyer",
      offer_from: {
        user_id: payload.buyerUserId,
        email: offerFrom.email ?? "",
        display_name: offerFrom.display_name,
      },
    },
    uniqueId: `offer-made-${payload.offerId}`,
    value: Number.isFinite(offerAmountNum) ? offerAmountNum : undefined,
    valueCurrency: "USD",
  })

  if (!result.ok && !result.skipped) {
    console.error(
      "[klaviyo] Offer Made event failed:",
      result.status,
      result.detail.slice(0, 300),
    )
  }
}
