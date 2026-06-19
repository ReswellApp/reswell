import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById, getStoreStaffRole } from "@/lib/db/consignmentStores"
import { respondToOfferService } from "@/lib/services/respondToOffer"
import type { RespondToOfferInput } from "@/lib/validations/respond-to-offer"

type RespondResult =
  | { ok: true; conversationId: string | null }
  | { ok: false; error: string; status: number }

/**
 * Staff responds to a buyer offer on a consigned listing. We act AS the shop (the offer's seller of
 * record = store owner) so the existing offer engine — including the consignor floor guard — applies
 * unchanged and the buyer keeps a single shop counterparty. Owners and managers can respond; clerks
 * cannot. The offer must belong to a listing in this store.
 */
export async function respondToStoreOffer(input: {
  staffProfileId: string
  storeId: string
  offer: RespondToOfferInput
}): Promise<RespondResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const role = await getStoreStaffRole(service, input.storeId, input.staffProfileId)
  if (role !== "owner" && role !== "manager") {
    return { ok: false, error: "Only owners and managers can respond to offers.", status: 403 }
  }

  const { data: offerRow, error: offerErr } = await service
    .from("offers")
    .select("id, listing:listings(consignment_store_id)")
    .eq("id", input.offer.offerId)
    .maybeSingle()

  if (offerErr || !offerRow) {
    return { ok: false, error: "Offer not found.", status: 404 }
  }

  const row = offerRow as unknown as {
    id: string
    listing: { consignment_store_id: string | null } | null
  }
  if (!row.listing || row.listing.consignment_store_id !== input.storeId) {
    return { ok: false, error: "This offer isn't part of your store.", status: 403 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) {
    return { ok: false, error: "Store not found.", status: 404 }
  }

  // Delegate to the shared offer engine as the shop owner (seller of record).
  const result = await respondToOfferService(service, store.ownerProfileId, input.offer)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 400 }
  }
  return { ok: true, conversationId: result.conversationId }
}
