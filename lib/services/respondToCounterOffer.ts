import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import type { RespondToCounterOfferInput } from "@/lib/validations/respond-to-counter-offer"

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
    .select("id, listing_id, buyer_id, seller_id, status, current_amount")
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

  const { data: listing, error: listErr } = await supabase
    .from("listings")
    .select("id, title, user_id")
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

  const conv = await getConversationForBuyerSeller(supabase, offer.buyer_id, offer.seller_id)

  if (action === "decline") {
    const { error: upErr } = await supabase
      .from("offers")
      .update({ status: "DECLINED", updated_at: new Date().toISOString() })
      .eq("id", offerId)
      .eq("buyer_id", buyerUserId)
      .eq("status", "COUNTERED")

    if (upErr) {
      console.error("[respondToCounterOffer] decline:", upErr)
      return { ok: false, error: "Could not decline the counteroffer. Try again." }
    }

    const { error: omErr } = await supabase.from("offer_messages").insert({
      offer_id: offerId,
      sender_id: buyerUserId,
      sender_role: "BUYER",
      action: "DECLINE",
      amount: current,
      note: null,
    })

    if (omErr) {
      console.error("[respondToCounterOffer] decline offer_messages:", omErr)
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

    return { ok: true, conversationId: conv?.id ?? null }
  }

  // accept
  const { error: upErr } = await supabase
    .from("offers")
    .update({
      status: "ACCEPTED",
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

  const { error: omErr } = await supabase.from("offer_messages").insert({
    offer_id: offerId,
    sender_id: buyerUserId,
    sender_role: "BUYER",
    action: "ACCEPT",
    amount: current,
    note: null,
  })

  if (omErr) {
    console.error("[respondToCounterOffer] accept offer_messages:", omErr)
  }

  await appendNegotiationLine(
    supabase,
    offer,
    buyerUserId,
    `Counteroffer accepted — $${current.toFixed(2)} for “${title}”. Complete checkout from your messages or listing when ready.`,
  )

  if (service) {
    await service.from("notifications").insert({
      user_id: offer.seller_id,
      type: "offer_accepted",
      listing_id: offer.listing_id,
      actor_id: buyerUserId,
      message: `${title}: buyer accepted your counter of $${current.toFixed(2)}.`,
    })
  }

  return { ok: true, conversationId: conv?.id ?? null }
}
