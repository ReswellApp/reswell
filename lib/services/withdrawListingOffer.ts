import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { appendConversationMessageWithClient } from "@/lib/services/conversationThread"
import { appendOfferTimelineEntry } from "@/lib/services/appendOfferTimeline"
import { deleteOfferRecord } from "@/lib/services/offerCleanup"

export type WithdrawListingOfferResult =
  | { ok: true; conversationId: string | null }
  | { ok: false; error: string }

export async function withdrawListingOffer(
  supabase: SupabaseClient,
  buyerId: string,
  offerId: string,
): Promise<WithdrawListingOfferResult> {
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, seller_id, status, current_amount, payment_intent_id")
    .eq("id", offerId)
    .maybeSingle()

  if (error || !offer) {
    return { ok: false, error: "Offer not found." }
  }
  if (offer.buyer_id !== buyerId) {
    return { ok: false, error: "Only the buyer can withdraw this offer." }
  }
  if (offer.status !== "PENDING") {
    return { ok: false, error: "This offer can no longer be withdrawn." }
  }

  const current = Math.round(parseFloat(String(offer.current_amount)) * 100) / 100
  const appended = await appendOfferTimelineEntry(offerId, {
    senderId: buyerId,
    senderRole: "BUYER",
    action: "WITHDRAW",
    amount: Number.isFinite(current) ? current : null,
    note: null,
  })
  if (!appended) {
    console.error("[withdrawListingOffer] timeline append failed")
  }

  const conv = await getConversationForBuyerSellerListing(
    supabase,
    offer.buyer_id,
    offer.seller_id,
    offer.listing_id,
  )
  await appendConversationMessageWithClient(supabase, {
    buyerId: offer.buyer_id,
    sellerId: offer.seller_id,
    listingId: offer.listing_id,
    senderId: buyerId,
    content: Number.isFinite(current)
      ? `Offer withdrawn — was $${current.toFixed(2)}.`
      : "Offer withdrawn.",
  })

  try {
    const service = createServiceRoleClient()
    await service.from("notifications").insert({
      user_id: offer.seller_id,
      type: "offer_withdrawn",
      listing_id: offer.listing_id,
      actor_id: buyerId,
      message: "A buyer withdrew their offer.",
    })
    await deleteOfferRecord(service, offerId)
  } catch (e) {
    console.error("[withdrawListingOffer] cleanup:", e)
    return { ok: false, error: "Could not withdraw the offer. Try again." }
  }

  return { ok: true, conversationId: conv?.id ?? null }
}
