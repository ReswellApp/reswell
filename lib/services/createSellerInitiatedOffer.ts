import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { fetchListingForOffer } from "@/lib/db/offers"
import { effectiveMinimumOfferPct } from "@/lib/utils/offers-minimum-pct"
import { trackKlaviyoSellerMadeOfferToBuyer } from "@/lib/klaviyo/track-seller-made-offer-to-buyer"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { formatSellerOfferThreadContent } from "@/lib/utils/format-offer-thread-content"
import { randomUUID } from "node:crypto"
import type { SellerInitiatedOfferBody } from "@/lib/validations/seller-initiated-offer"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type CreateSellerInitiatedOfferResult =
  | { ok: true; offerId: string; conversationId: string | null }
  | { ok: false; status: number; error: string }

async function findActiveNegotiationForBuyerListing(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .in("status", ["PENDING", "COUNTERED"])
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id as string }
}

/**
 * Listing owner proposes a price to a buyer (e.g. from Messages → Activity after a favorite).
 * Persists as status COUNTERED with `seller_initiated` so the buyer can accept/decline via the same flow as a counteroffer.
 */
export async function createSellerInitiatedOffer(
  supabase: SupabaseClient,
  sellerUserId: string,
  listingId: string,
  body: SellerInitiatedOfferBody,
): Promise<CreateSellerInitiatedOfferResult> {
  const { buyerUserId, amount: rawAmount, message: rawMessage } = body
  const message =
    typeof rawMessage === "string" && rawMessage.trim() !== "" ? rawMessage.trim() : undefined

  if (buyerUserId === sellerUserId) {
    return { ok: false, status: 400, error: "Invalid buyer." }
  }

  const listing = await fetchListingForOffer(supabase, listingId)
  if (!listing) {
    return { ok: false, status: 404, error: "Listing not found." }
  }

  if (listing.hidden_from_site) {
    return { ok: false, status: 404, error: "Listing not found." }
  }

  if (listing.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "You can only make offers on your own listings." }
  }

  if (listing.section !== "surfboards") {
    return { ok: false, status: 400, error: "Offers are not available for this listing type." }
  }

  if (listing.status !== "active" && listing.status !== "pending_sale") {
    return { ok: false, status: 400, error: "This listing is not accepting offers." }
  }

  if (listing.buyer_offers_enabled === false) {
    return { ok: false, status: 400, error: "You are not accepting offers on this item." }
  }

  const listPrice = roundMoney(parseFloat(String(listing.price)))
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return { ok: false, status: 400, error: "This listing does not have a valid price." }
  }

  const minPct = effectiveMinimumOfferPct(listing)
  const minOffer = roundMoney(listPrice * (minPct / 100))
  const amount = roundMoney(rawAmount)

  if (amount < minOffer) {
    return {
      ok: false,
      status: 400,
      error: `Your offer must be at least $${minOffer.toFixed(2)} (${minPct}% of the list price).`,
    }
  }

  if (amount > listPrice) {
    return {
      ok: false,
      status: 400,
      error: `Your offer can’t exceed the list price ($${listPrice.toFixed(2)}).`,
    }
  }

  const active = await findActiveNegotiationForBuyerListing(supabase, listingId, buyerUserId)
  if (active) {
    return {
      ok: false,
      status: 409,
      error:
        "There is already an open offer with this buyer on this listing. Resolve it first or continue in messages.",
    }
  }

  const note = message ? message.slice(0, 200) : null

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[createSellerInitiatedOffer] service client:", e)
    return { ok: false, status: 503, error: "Offers are temporarily unavailable." }
  }

  const offerExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const timelineEntry = {
    id: randomUUID(),
    sender_id: sellerUserId,
    sender_role: "SELLER" as const,
    action: "COUNTER",
    amount,
    note,
    created_at: new Date().toISOString(),
  }

  const { data: inserted, error: offerErr } = await service
    .from("offers")
    .insert({
      listing_id: listingId,
      buyer_id: buyerUserId,
      seller_id: sellerUserId,
      status: "COUNTERED",
      initial_amount: amount,
      current_amount: amount,
      counter_count: 0,
      seller_initiated: true,
      expires_at: offerExpiresAt,
      offer_timeline: [timelineEntry],
    })
    .select("id")
    .single()

  if (offerErr || !inserted?.id) {
    console.error("[createSellerInitiatedOffer] insert offer:", offerErr)
    return { ok: false, status: 500, error: "Could not send your offer. Try again in a moment." }
  }

  const offerId = inserted.id as string

  const counterText = formatSellerOfferThreadContent(amount, note)

  const threadResult = await appendConversationMessageWithClient(service, {
    buyerId: buyerUserId,
    sellerId: sellerUserId,
    listingId,
    senderId: sellerUserId,
    content: counterText,
    offerId,
  })

  if (!threadResult.ok) {
    console.error("[createSellerInitiatedOffer] thread mirror failed")
  }

  const title = (listing.title ?? "your listing").trim() || "your listing"

  const { error: notifErr } = await service.from("notifications").insert({
    user_id: buyerUserId,
    type: "offer_countered",
    listing_id: listingId,
    actor_id: sellerUserId,
    message: `${title}: the seller offered $${amount.toFixed(2)}.`,
  })

  if (notifErr) {
    console.error("[createSellerInitiatedOffer] notification:", notifErr)
  }

  void trackKlaviyoSellerMadeOfferToBuyer({
    offerId,
    counterRound: 1,
    listingId,
    listingTitle: title,
    listingSlug: listing.slug?.trim() ? listing.slug : null,
    listingSection: listing.section,
    listPrice,
    offerAmount: amount,
    buyerUserId,
    sellerUserId,
    counterNote: note,
  })

  return {
    ok: true,
    offerId,
    conversationId: threadResult.ok ? threadResult.conversationId : null,
  }
}
