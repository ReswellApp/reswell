import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  fetchListingForOffer,
  fetchOfferSettings,
  findPendingOfferForBuyer,
} from "@/lib/db/offers"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import type { CreateListingOfferBody } from "@/lib/validations/create-listing-offer"
import { trackKlaviyoOfferMade } from "@/lib/klaviyo/track-offer-made"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function composeOfferNote(input: CreateListingOfferBody): string | null {
  const regionLabel: Record<string, string> = {
    continental: "Continental US",
    alaska_hawaii: "Alaska / Hawaii",
    international: "International",
  }
  const parts: string[] = []
  if (input.shippingRegion && input.shippingRegion !== "continental") {
    parts.push(regionLabel[input.shippingRegion] ?? input.shippingRegion)
  }
  if (input.shipZip) {
    parts.push(`ZIP ${input.shipZip}`)
  }
  const prefix = parts.length > 0 ? `[${parts.join(" · ")}] ` : ""
  const body = (input.message ?? "").trim()
  const combined = `${prefix}${body}`.trim()
  if (!combined) return null
  return combined.slice(0, 200)
}

export type CreateListingOfferResult =
  | { ok: true; offerId: string }
  | { ok: false; status: number; error: string }

/**
 * Creates a buyer offer and initial thread message. Sends seller notification via service role.
 */
export async function createListingOffer(
  supabase: SupabaseClient,
  buyerId: string,
  listingId: string,
  body: CreateListingOfferBody,
): Promise<CreateListingOfferResult> {
  const listing = await fetchListingForOffer(supabase, listingId)
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found." }
  }

  if (listing.hidden_from_site) {
    return { ok: false, status: 404, error: "Listing not found." }
  }

  if (listing.section !== "surfboards") {
    return { ok: false, status: 400, error: "Offers are not available for this listing type." }
  }

  if (listing.status !== "active" && listing.status !== "pending_sale") {
    return { ok: false, status: 400, error: "This listing is not accepting offers." }
  }

  if (listing.user_id === buyerId) {
    return { ok: false, status: 400, error: "You can’t make an offer on your own listing." }
  }

  if (listing.buyer_offers_enabled === false) {
    return { ok: false, status: 400, error: "The seller is not accepting offers on this item." }
  }

  const settings = await fetchOfferSettings(supabase, listingId)
  if (settings && settings.offers_enabled === false) {
    return { ok: false, status: 400, error: "The seller is not accepting offers on this item." }
  }

  const pickupOk = listing.local_pickup !== false
  const shipOk = !!listing.shipping_available
  if (body.fulfillment === "pickup" && !pickupOk) {
    return { ok: false, status: 400, error: "Local pickup isn’t available for this listing." }
  }
  if (body.fulfillment === "shipping" && !shipOk) {
    return { ok: false, status: 400, error: "Shipping isn’t available for this listing." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (Number.isNaN(listPrice) || listPrice <= 0) {
    return { ok: false, status: 400, error: "This listing doesn’t have a valid price." }
  }

  const minPct = settings?.minimum_offer_pct ?? 70
  const minOffer = roundMoney(listPrice * (minPct / 100))
  const amount = roundMoney(body.amount)
  if (amount < minOffer) {
    return {
      ok: false,
      status: 400,
      error: `Your offer must be at least $${minOffer.toFixed(2)} (${minPct}% of the list price).`,
    }
  }
  if (amount > listPrice) {
    return { ok: false, status: 400, error: `Your offer can’t exceed the list price ($${listPrice.toFixed(2)}).` }
  }

  const pending = await findPendingOfferForBuyer(supabase, listingId, buyerId)
  if (pending) {
    return {
      ok: false,
      status: 409,
      error: "You already have an open offer on this listing. Check your messages or wait for the seller to respond.",
    }
  }

  const resolved = resolvePayableAmount(listing, body.fulfillment)
  if (!resolved.ok) {
    return { ok: false, status: 400, error: resolved.error }
  }

  const note = composeOfferNote(body)

  const { data: inserted, error: offerErr } = await supabase
    .from("offers")
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: listing.user_id,
      status: "PENDING",
      initial_amount: amount,
      current_amount: amount,
    })
    .select("id")
    .single()

  if (offerErr || !inserted?.id) {
    console.error("[createListingOffer] insert offer:", offerErr)
    return { ok: false, status: 500, error: "Could not submit your offer. Try again in a moment." }
  }

  const offerId = inserted.id as string

  const { error: msgErr } = await supabase.from("offer_messages").insert({
    offer_id: offerId,
    sender_id: buyerId,
    sender_role: "BUYER",
    action: "OFFER",
    amount,
    note,
  })

  if (msgErr) {
    console.error("[createListingOffer] insert offer_messages:", msgErr)
    await supabase.from("offers").delete().eq("id", offerId)
    return { ok: false, status: 500, error: "Could not submit your offer. Try again in a moment." }
  }

  const title = (listing.title ?? "your listing").trim() || "your listing"

  void trackKlaviyoOfferMade({
    offerId,
    listingId,
    listingTitle: title,
    listingSlug: listing.slug?.trim() ? listing.slug : null,
    listingSection: listing.section,
    listPrice: listPrice,
    offerAmount: amount,
    buyerUserId: buyerId,
    sellerUserId: listing.user_id,
  })

  let service
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[createListingOffer] service client:", e)
    return { ok: true, offerId }
  }

  const { error: notifErr } = await service.from("notifications").insert({
    user_id: listing.user_id,
    type: "offer_received",
    listing_id: listingId,
    actor_id: buyerId,
    message: `New offer of $${amount.toFixed(2)} on ${title}`,
  })

  if (notifErr) {
    console.error("[createListingOffer] notification:", notifErr)
  }

  return { ok: true, offerId }
}
