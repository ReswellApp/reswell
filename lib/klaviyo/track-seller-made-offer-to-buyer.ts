/**
 * Server-only: Klaviyo Events API — fires when a seller counters a buyer’s offer (proposed price).
 *
 * **Metric name in Klaviyo:** `Seller Made Offer` — profile is the **buyer** so flows can email them.
 * Seller details live under `offer_from` (nested) to avoid Klaviyo mis-attaching scalar email props.
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

export type KlaviyoSellerMadeOfferToBuyerPayload = {
  offerId: string
  /** 1-based counter round — unique id per seller counter event */
  counterRound: number
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listPrice: number
  /** Seller’s proposed price (counter amount) */
  offerAmount: number
  buyerUserId: string
  sellerUserId: string
  counterNote?: string | null
}

export async function trackKlaviyoSellerMadeOfferToBuyer(
  payload: KlaviyoSellerMadeOfferToBuyerPayload,
): Promise<void> {
  const [buyerEmail, offerFrom] = await Promise.all([
    getAuthEmailForUserId(payload.buyerUserId),
    getSellerOfferFromFields(payload.sellerUserId),
  ])

  const listPriceNum =
    typeof payload.listPrice === "number" ? payload.listPrice : Number(payload.listPrice)
  const offerAmountNum =
    typeof payload.offerAmount === "number" ? payload.offerAmount : Number(payload.offerAmount)

  const origin = publicSiteOrigin()
  const path = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${path}`

  const note =
    typeof payload.counterNote === "string" && payload.counterNote.trim() !== ""
      ? payload.counterNote.trim().slice(0, 500)
      : null

  await sendKlaviyoServerEvent({
    metricName: "Seller Made Offer",
    profile: {
      external_id: payload.buyerUserId,
      email: buyerEmail,
    },
    properties: {
      time: new Date().toISOString(),
      listing_id: payload.listingId,
      offer_id: payload.offerId,
      counter_round: payload.counterRound,
      offer_amount: Number.isFinite(offerAmountNum) ? offerAmountNum : payload.offerAmount,
      list_price: Number.isFinite(listPriceNum) ? listPriceNum : payload.listPrice,
      Title: payload.listingTitle,
      listing_url: listingUrl,
      counter_note: note,
      offer_from: {
        user_id: payload.sellerUserId,
        email: offerFrom.email ?? "",
        display_name: offerFrom.display_name,
      },
    },
    uniqueId: `seller-made-offer-${payload.offerId}-c${payload.counterRound}`,
    value: Number.isFinite(offerAmountNum) ? offerAmountNum : undefined,
    valueCurrency: "USD",
  })
}
