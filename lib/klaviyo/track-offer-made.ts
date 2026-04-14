/**
 * Server-only: Klaviyo Events API — fires when a buyer submits an offer on a listing.
 *
 * **Metric name in Klaviyo:** `Offer Made` — profile is the **seller** so flows can email them.
 * Buyer details live under `offer_from` (nested) to avoid Klaviyo mis-attaching scalar email props.
 */

import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
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

  const origin = publicSiteOrigin()
  const path = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${path}`

  await sendKlaviyoServerEvent({
    metricName: "Offer Made",
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    properties: {
      time: new Date().toISOString(),
      listing_id: payload.listingId,
      offer_id: payload.offerId,
      offer_amount: Number.isFinite(offerAmountNum)
        ? offerAmountNum
        : payload.offerAmount,
      list_price: Number.isFinite(listPriceNum)
        ? listPriceNum
        : payload.listPrice,
      Title: payload.listingTitle,
      listing_url: listingUrl,
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
}
