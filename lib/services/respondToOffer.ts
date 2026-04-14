import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { fetchOfferSettings } from "@/lib/db/offers"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import type { RespondToOfferInput } from "@/lib/validations/respond-to-offer"

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
    .select("id, listing_id, buyer_id, seller_id, status, current_amount, counter_count")
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
    .select("id, price, title, user_id")
    .eq("id", offer.listing_id)
    .maybeSingle()

  if (listErr || !listing || listing.user_id !== sellerUserId) {
    return { ok: false, error: "Listing not found." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { ok: false, error: "Invalid listing price." }
  }

  const settings = await fetchOfferSettings(supabase, offer.listing_id)
  const minPct = settings?.minimum_offer_pct ?? 70
  const minOffer = roundMoney(listPrice * (minPct / 100))

  const current = roundMoney(parseFloat(String(offer.current_amount)))

  let service: ReturnType<typeof createServiceRoleClient> | null = null
  try {
    service = createServiceRoleClient()
  } catch {
    service = null
  }

  const conv = await getConversationForBuyerSeller(supabase, offer.buyer_id, offer.seller_id)

  const title = ((listing.title ?? "") as string).trim() || "your listing"

  if (action === "decline") {
    const { error: upErr } = await supabase
      .from("offers")
      .update({ status: "DECLINED", updated_at: new Date().toISOString() })
      .eq("id", offerId)
      .eq("seller_id", sellerUserId)
      .eq("status", "PENDING")

    if (upErr) {
      console.error("[respondToOffer] decline:", upErr)
      return { ok: false, error: "Could not decline the offer. Try again." }
    }

    const { error: omErr } = await supabase.from("offer_messages").insert({
      offer_id: offerId,
      sender_id: sellerUserId,
      sender_role: "SELLER",
      action: "DECLINE",
      amount: current,
      note: null,
    })

    if (omErr) {
      console.error("[respondToOffer] decline offer_messages:", omErr)
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

    return { ok: true, conversationId: conv?.id ?? null }
  }

  if (action === "accept") {
    const { error: upErr } = await supabase
      .from("offers")
      .update({
        status: "ACCEPTED",
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

    const { error: omErr } = await supabase.from("offer_messages").insert({
      offer_id: offerId,
      sender_id: sellerUserId,
      sender_role: "SELLER",
      action: "ACCEPT",
      amount: current,
      note: null,
    })

    if (omErr) {
      console.error("[respondToOffer] accept offer_messages:", omErr)
    }

    await appendNegotiationLine(
      supabase,
      offer,
      sellerUserId,
      `Offer accepted — $${current.toFixed(2)} for “${title}”. Complete checkout from your messages or listing when ready.`,
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

  const { error: omErr } = await supabase.from("offer_messages").insert({
    offer_id: offerId,
    sender_id: sellerUserId,
    sender_role: "SELLER",
    action: "COUNTER",
    amount: amt,
    note: noteTrim,
  })

  if (omErr) {
    console.error("[respondToOffer] counter offer_messages:", omErr)
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

  return { ok: true, conversationId: conv?.id ?? null }
}
