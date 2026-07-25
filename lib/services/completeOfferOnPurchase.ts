import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchAcceptedOfferById,
  findAcceptedOfferMatchingListings,
} from "@/lib/services/acceptedOfferCheckout"
import { appendOfferTimelineEntry } from "@/lib/services/appendOfferTimeline"
import { deleteNonWinningOffersOnListings } from "@/lib/services/offerCleanup"

/**
 * When checkout completes, mark the matching ACCEPTED offer COMPLETED so only
 * buyer and seller retain the record on /dashboard/offers (not Messages).
 * Removes all other offers on the sold listing(s).
 */
export async function completeAcceptedOfferOnPurchase(
  serviceSupabase: SupabaseClient,
  buyerId: string,
  listingIds: string[],
  sellerId: string,
  offerId?: string | null,
): Promise<void> {
  if (listingIds.length === 0 || !buyerId.trim() || !sellerId.trim()) return

  const explicitOfferId = offerId?.trim() || null
  const offer = explicitOfferId
    ? await fetchAcceptedOfferById(serviceSupabase, explicitOfferId)
    : await findAcceptedOfferMatchingListings(
        serviceSupabase,
        buyerId,
        listingIds,
        sellerId,
      )

  let keepOfferId: string | null = null

  if (
    offer &&
    offer.status === "ACCEPTED" &&
    offer.buyer_id === buyerId &&
    offer.seller_id === sellerId
  ) {
    const now = new Date().toISOString()
    const { error } = await serviceSupabase
      .from("offers")
      .update({
        status: "COMPLETED",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", offer.id)
      .eq("status", "ACCEPTED")

    if (error) {
      console.error("[completeAcceptedOfferOnPurchase]", error)
    } else {
      keepOfferId = offer.id
      const amountRaw = parseFloat(String(offer.current_amount))
      void appendOfferTimelineEntry(offer.id, {
        senderId: buyerId,
        senderRole: "BUYER",
        action: "COMPLETED",
        amount: Number.isFinite(amountRaw) ? amountRaw : null,
        note: null,
      })
    }
  }

  await deleteNonWinningOffersOnListings(serviceSupabase, listingIds, keepOfferId)
}
