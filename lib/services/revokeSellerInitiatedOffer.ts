import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { appendConversationMessageWithClient, rewriteOfferThreadMessages } from "@/lib/services/conversationThread"
import { appendOfferTimelineEntry } from "@/lib/services/appendOfferTimeline"
import { deleteOfferRecord } from "@/lib/services/offerCleanup"

export type RevokeSellerInitiatedOfferResult =
  | { ok: true; conversationId: string | null }
  | { ok: false; error: string }

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Seller takes back an offer they sent the buyer, while it is still waiting on a response.
 */
export async function revokeSellerInitiatedOffer(
  supabase: SupabaseClient,
  sellerUserId: string,
  offerId: string,
): Promise<RevokeSellerInitiatedOfferResult> {
  const { data: offer, error } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, seller_id, status, current_amount, seller_initiated")
    .eq("id", offerId)
    .maybeSingle()

  if (error || !offer) {
    return { ok: false, error: "Offer not found." }
  }
  if (offer.seller_id !== sellerUserId) {
    return { ok: false, error: "Only the seller can revoke this offer." }
  }
  if (offer.seller_initiated !== true) {
    return { ok: false, error: "Only offers you sent to a buyer can be revoked here." }
  }
  if (offer.status !== "COUNTERED") {
    return { ok: false, error: "This offer can no longer be revoked." }
  }

  const current = roundMoney(parseFloat(String(offer.current_amount)))
  const withdrawnText = Number.isFinite(current)
    ? `Offer withdrawn — was $${current.toFixed(2)}.`
    : "Offer withdrawn."

  const appended = await appendOfferTimelineEntry(offerId, {
    senderId: sellerUserId,
    senderRole: "SELLER",
    action: "WITHDRAW",
    amount: Number.isFinite(current) ? current : null,
    note: null,
  })
  if (!appended) {
    console.error("[revokeSellerInitiatedOffer] timeline append failed")
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch (e) {
    console.error("[revokeSellerInitiatedOffer] service client:", e)
    return { ok: false, error: "Could not revoke the offer. Try again." }
  }

  const rewritten = await rewriteOfferThreadMessages(service, {
    offerId,
    content: withdrawnText,
    buyerId: offer.buyer_id,
    sellerId: offer.seller_id,
    detachOfferId: true,
  })

  let conversationId = rewritten.ok ? rewritten.conversationId : null
  if (!rewritten.ok || rewritten.updated === 0) {
    const thread = await appendConversationMessageWithClient(service, {
      buyerId: offer.buyer_id,
      sellerId: offer.seller_id,
      listingId: offer.listing_id,
      senderId: sellerUserId,
      content: withdrawnText,
    })
    if (thread.ok) conversationId = thread.conversationId
  }

  const { data: listing } = await service
    .from("listings")
    .select("title")
    .eq("id", offer.listing_id)
    .maybeSingle()
  const title = ((listing?.title as string | undefined) ?? "A listing").trim() || "A listing"

  const { error: notifErr } = await service.from("notifications").insert({
    user_id: offer.buyer_id,
    type: "offer_withdrawn",
    listing_id: offer.listing_id,
    actor_id: sellerUserId,
    message: `${title}: the seller revoked their offer.`,
  })
  if (notifErr) {
    console.error("[revokeSellerInitiatedOffer] notification:", notifErr)
  }

  try {
    await deleteOfferRecord(service, offerId)
  } catch (e) {
    console.error("[revokeSellerInitiatedOffer] cleanup:", e)
    return { ok: false, error: "Could not revoke the offer. Try again." }
  }

  return { ok: true, conversationId }
}
