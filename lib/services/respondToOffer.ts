import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoOfferAccepted } from "@/lib/klaviyo/track-offer-accepted"
import { trackKlaviyoSellerMadeOfferToBuyer } from "@/lib/klaviyo/track-seller-made-offer-to-buyer"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { appendOfferTimelineEntry } from "@/lib/services/appendOfferTimeline"
import { deleteOfferRecord } from "@/lib/services/offerCleanup"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import type { RespondToOfferInput } from "@/lib/validations/respond-to-offer"
import { reconcileOfferFulfillmentWithListing } from "@/lib/offer-listing-shipping"

const MAX_COUNTERS = 3

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

export type RespondToOfferServiceResult =
  | { ok: true; conversationId: string | null }
  | { ok: false; error: string }

export async function respondToOfferService(
  supabase: SupabaseClient,
  sellerUserId: string,
  input: RespondToOfferInput,
): Promise<RespondToOfferServiceResult> {
  const { offerId, action, counterAmount, counterNote } = input

  const { data: offer, error: offerErr } = await supabase
    .from("offers")
    .select(
      "id, listing_id, buyer_id, seller_id, status, current_amount, counter_count, fulfillment, shipping_amount",
    )
    .eq("id", offerId)
    .maybeSingle()

  if (offerErr || !offer) {
    return { ok: false, error: "Offer not found." }
  }

  if (offer.seller_id !== sellerUserId) {
    return { ok: false, error: "Only the seller can respond to this offer." }
  }

  if (offer.status !== "PENDING") {
    return {
      ok: false,
      error:
        offer.status === "COUNTERED"
          ? "Wait for the buyer to respond to your counter."
          : "This offer can no longer be updated from here.",
    }
  }

  const { data: listing, error: listErr } = await supabase
    .from("listings")
    .select(
      "id, price, title, user_id, slug, section, minimum_offer_pct, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode",
    )
    .eq("id", offer.listing_id)
    .maybeSingle()

  if (listErr || !listing || listing.user_id !== sellerUserId) {
    return { ok: false, error: "Listing not found." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { ok: false, error: "Invalid listing price." }
  }

  const minPct = effectiveMinimumOfferPct(listing as { minimum_offer_pct?: number | null })
  const minOffer = roundMoney(listPrice * (minPct / 100))

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

  const title = ((listing.title ?? "") as string).trim() || "your listing"

  if (action === "decline") {
    const appended = await appendOfferTimelineEntry(offerId, {
      senderId: sellerUserId,
      senderRole: "SELLER",
      action: "DECLINE",
      amount: current,
      note: null,
    })

    if (!appended) {
      console.error("[respondToOffer] decline offer_timeline append failed")
    }

    await appendNegotiationLine(
      supabase,
      offer,
      sellerUserId,
      `Offer declined — was $${current.toFixed(2)} on “${title}”.`,
    )

    if (service) {
      await service.from("notifications").insert({
        user_id: offer.buyer_id,
        type: "offer_declined",
        listing_id: offer.listing_id,
        actor_id: sellerUserId,
        message: `${title}: your offer was declined.`,
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

  if (action === "accept") {
    const reconciled = reconcileOfferFulfillmentWithListing(
      (offer as { fulfillment?: string | null }).fulfillment,
      listing,
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
      .eq("seller_id", sellerUserId)
      .eq("status", "PENDING")

    if (upErr) {
      console.error("[respondToOffer] accept:", upErr)
      return { ok: false, error: "Could not accept the offer. Try again." }
    }

    const appended = await appendOfferTimelineEntry(offerId, {
      senderId: sellerUserId,
      senderRole: "SELLER",
      action: "ACCEPT",
      amount: current,
      note: null,
    })

    if (!appended) {
      console.error("[respondToOffer] accept offer_timeline append failed")
    }

    await appendNegotiationLine(
      supabase,
      offer,
      sellerUserId,
      `Offer accepted — $${current.toFixed(2)}.`,
    )

    if (service) {
      await service.from("notifications").insert({
        user_id: offer.buyer_id,
        type: "offer_accepted",
        listing_id: offer.listing_id,
        actor_id: sellerUserId,
        message: `${title}: your offer of $${current.toFixed(2)} was accepted.`,
      })
    }

    void trackKlaviyoOfferAccepted({
      offerId,
      listingId: offer.listing_id as string,
      listingTitle: title,
      listingSlug: (listing.slug as string | null | undefined) ?? null,
      listingSection: (listing.section as string) || "surfboards",
      listPrice,
      offerAmount: current,
      buyerUserId: offer.buyer_id as string,
      sellerUserId,
      acceptedBy: "seller",
      fulfillment: reconciled.fulfillment,
      conversationId: conv?.id ?? null,
    }).catch((e) => {
      console.error("[respondToOffer] klaviyo Offer Accepted:", e)
    })

    return { ok: true, conversationId: conv?.id ?? null }
  }

  // counter
  if (offer.counter_count >= MAX_COUNTERS) {
    return { ok: false, error: "Maximum number of counters has been reached for this offer." }
  }

  const raw = counterAmount
  if (raw === undefined) {
    return { ok: false, error: "Enter a counter amount." }
  }

  const amt = roundMoney(raw)
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: "Enter a valid counter amount." }
  }

  if (amt < minOffer) {
    return {
      ok: false,
      error: `Counter must be at least $${minOffer.toFixed(2)} (${minPct}% of list price).`,
    }
  }

  if (amt > listPrice) {
    return { ok: false, error: `Counter can’t exceed the list price ($${listPrice.toFixed(2)}).` }
  }

  if (amt <= current) {
    return {
      ok: false,
      error: `Counter must be higher than the buyer’s current offer ($${current.toFixed(2)}).`,
    }
  }

  const noteTrim =
    typeof counterNote === "string" && counterNote.trim() !== ""
      ? counterNote.trim().slice(0, 200)
      : null

  const nextCount = (offer.counter_count ?? 0) + 1

  const { error: upErr } = await supabase
    .from("offers")
    .update({
      status: "COUNTERED",
      current_amount: amt,
      counter_count: nextCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("seller_id", sellerUserId)
    .eq("status", "PENDING")

  if (upErr) {
    console.error("[respondToOffer] counter update:", upErr)
    return { ok: false, error: "Could not save your counter. Try again." }
  }

  const appended = await appendOfferTimelineEntry(offerId, {
    senderId: sellerUserId,
    senderRole: "SELLER",
    action: "COUNTER",
    amount: amt,
    note: noteTrim,
  })

  if (!appended) {
    console.error("[respondToOffer] counter offer_timeline append failed")
  }

  const counterText =
    noteTrim !== null
      ? `Counteroffer: $${amt.toFixed(2)} — ${noteTrim}`
      : `Counteroffer: $${amt.toFixed(2)}`

  await appendNegotiationLine(supabase, offer, sellerUserId, counterText)

  if (service) {
    await service.from("notifications").insert({
      user_id: offer.buyer_id,
      type: "offer_countered",
      listing_id: offer.listing_id,
      actor_id: sellerUserId,
      message: `${title}: new counter of $${amt.toFixed(2)}.`,
    })
  }

  void trackKlaviyoSellerMadeOfferToBuyer({
    offerId: offerId,
    counterRound: nextCount,
    listingId: offer.listing_id as string,
    listingTitle: title,
    listingSlug: (listing.slug as string | null | undefined) ?? null,
    listingSection: (listing.section as string) || "surfboards",
    listPrice,
    offerAmount: amt,
    buyerUserId: offer.buyer_id as string,
    sellerUserId,
    counterNote: noteTrim,
  })

  return { ok: true, conversationId: conv?.id ?? null }
}
