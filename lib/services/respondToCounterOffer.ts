import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoOfferAccepted } from "@/lib/klaviyo/track-offer-accepted"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { appendOfferTimelineEntry } from "@/lib/services/appendOfferTimeline"
import { deleteOfferRecord } from "@/lib/services/offerCleanup"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import type { RespondToCounterOfferInput } from "@/lib/validations/respond-to-counter-offer"
import { reconcileOfferFulfillmentWithListing } from "@/lib/offer-listing-shipping"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

async function appendNegotiationLine(
  supabase: SupabaseClient,
  offer: { buyer_id: string; seller_id: string; listing_id: string },
  senderId: string,
  text: string,
): Promise<boolean> {
  const r = await appendConversationMessageWithClient(supabase, {
    buyerId: offer.buyer_id,
    sellerId: offer.seller_id,
    listingId: offer.listing_id,
    senderId,
    content: text,
  })
  return r.ok
}

export type RespondToCounterOfferServiceResult =
  | { ok: true; conversationId: string | null }
  | { ok: false; error: string }

/**
 * Buyer accepts or declines the seller’s counteroffer (offer status must be COUNTERED).
 */
export async function respondToCounterOfferService(
  supabase: SupabaseClient,
  buyerUserId: string,
  input: RespondToCounterOfferInput,
): Promise<RespondToCounterOfferServiceResult> {
  const { offerId, action } = input

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select(
      "id, listing_id, buyer_id, seller_id, status, current_amount, expires_at, line_items, fulfillment, shipping_amount",
    )
    .eq("id", offerId)
    .maybeSingle()

  if (offerErr || !offer) {
    return { ok: false, error: "Offer not found." }
  }

  if (offer.buyer_id !== buyerUserId) {
    return { ok: false, error: "Only the buyer can respond to this counteroffer." }
  }

  if (offer.status !== "COUNTERED") {
    return {
      ok: false,
      error:
        offer.status === "PENDING"
          ? "The seller hasn’t countered yet."
          : "This offer can no longer be updated from here.",
    }
  }

  const expiresRaw = (offer as { expires_at?: string | null }).expires_at
  if (expiresRaw) {
    const expMs = new Date(expiresRaw).getTime()
    if (Number.isFinite(expMs) && expMs <= Date.now()) {
      return {
        ok: false,
        error: "This offer has expired. You can message the seller or wait for another offer.",
      }
    }
  }

  const { data: listing, error: listErr } = await supabase
    .from("listings")
    .select(
      "id, title, user_id, slug, section, price, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode",
    )
    .eq("id", offer.listing_id)
    .maybeSingle()

  if (listErr || !listing || listing.user_id !== offer.seller_id) {
    return { ok: false, error: "Listing not found." }
  }

  const title = ((listing.title ?? "") as string).trim() || "this listing"
  const current = roundMoney(parseFloat(String(offer.current_amount)))

  let service: ReturnType<typeof createServiceRoleClient> | null = null
  try {
    service = createServiceRoleClient()
  } catch {
    service = null
  }

  const conv = await getConversationForBuyerSellerListing(
    supabase,
    offer.buyer_id,
    offer.seller_id,
    offer.listing_id,
  )

  if (action === "decline") {
    const appended = await appendOfferTimelineEntry(offerId, {
      senderId: buyerUserId,
      senderRole: "BUYER",
      action: "DECLINE",
      amount: current,
      note: null,
    })

    if (!appended) {
      console.error("[respondToCounterOffer] decline offer_timeline append failed")
    }

    await appendNegotiationLine(
      supabase,
      offer,
      buyerUserId,
      `Counteroffer declined — seller asked $${current.toFixed(2)} on “${title}”.`,
    )

    if (service) {
      await service.from("notifications").insert({
        user_id: offer.seller_id,
        type: "offer_declined",
        listing_id: offer.listing_id,
        actor_id: buyerUserId,
        message: `${title}: the buyer declined your counter of $${current.toFixed(2)}.`,
      })
    }

    const deleteClient = service ?? (() => {
      try {
        return createServiceRoleClient()
      } catch {
        return null
      }
    })()
    if (deleteClient) {
      await deleteOfferRecord(deleteClient, offerId)
    }

    return { ok: true, conversationId: conv?.id ?? null }
  }

  // accept — offer price is stored on offers only; listings.price stays at the original list price.
  const lineItems = parseOfferLineItems((offer as { line_items?: unknown }).line_items)
  const isBundle = !!lineItems && lineItems.length > 1
  const reconciled = reconcileOfferFulfillmentWithListing(
    (offer as { fulfillment?: string | null }).fulfillment,
    {
      shipping_available: isBundle ? false : listing.shipping_available,
      local_pickup: listing.local_pickup,
      shipping_price: listing.shipping_price,
      board_shipping_cost_mode: listing.board_shipping_cost_mode,
    },
  )
  if (!reconciled.fulfillment) {
    return {
      ok: false,
      error: reconciled.reason ?? "This offer’s delivery method is no longer available.",
    }
  }

  const { error: upErr } = await supabase
    .from("offers")
    .update({
      status: "ACCEPTED",
      fulfillment: reconciled.fulfillment,
      shipping_amount: reconciled.shippingAmount,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("buyer_id", buyerUserId)
    .eq("status", "COUNTERED")

  if (upErr) {
    console.error("[respondToCounterOffer] accept:", upErr)
    return { ok: false, error: "Could not accept the counteroffer. Try again." }
  }

  const appended = await appendOfferTimelineEntry(offerId, {
    senderId: buyerUserId,
    senderRole: "BUYER",
    action: "ACCEPT",
    amount: current,
    note: null,
  })

  if (!appended) {
    console.error("[respondToCounterOffer] accept offer_timeline append failed")
  }
  if (lineItems && lineItems.length > 1) {
    for (const row of lineItems) {
      const { error: cartErr } = await supabase.from("cart_items").insert({
        profile_id: buyerUserId,
        listing_id: row.listing_id,
      })
      if (cartErr && cartErr.code !== "23505") {
        console.error("[respondToCounterOffer] bundle cart sync:", cartErr)
      }
    }
  }

  const acceptText =
    lineItems && lineItems.length > 1
      ? `Offer accepted — $${current.toFixed(2)} for ${lineItems.length} items. You can check out the full bundle in one payment from messages or Offers.`
      : `Counteroffer accepted — $${current.toFixed(2)} for “${title}”. You can purchase at this price from messages or the listing when you choose; you’re not required to.`

  await appendNegotiationLine(supabase, offer, buyerUserId, acceptText)

  if (service) {
    await service.from("notifications").insert({
      user_id: offer.seller_id,
      type: "offer_accepted",
      listing_id: offer.listing_id,
      actor_id: buyerUserId,
      message: `${title}: buyer accepted your counter of $${current.toFixed(2)}.`,
    })
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  void trackKlaviyoOfferAccepted({
    offerId,
    listingId: offer.listing_id as string,
    listingTitle: title,
    listingSlug: (listing.slug as string | null | undefined) ?? null,
    listingSection: (listing.section as string) || "surfboards",
    listPrice: Number.isFinite(listPrice) ? listPrice : current,
    offerAmount: current,
    buyerUserId: buyerUserId,
    sellerUserId: offer.seller_id as string,
    acceptedBy: "buyer",
    fulfillment: reconciled.fulfillment,
    conversationId: conv?.id ?? null,
  }).catch((e) => {
    console.error("[respondToCounterOffer] klaviyo Offer Accepted:", e)
  })

  return { ok: true, conversationId: conv?.id ?? null }
}
