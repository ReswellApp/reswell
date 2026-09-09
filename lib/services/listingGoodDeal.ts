import { updateListingIsGoodDeal } from "@/lib/db/listings"
import { createServiceRoleClient } from "@/lib/supabase/server"

type ListingGoodDealResult =
  | { ok: true }
  | { ok: false; message: string; status: 400 | 404 | 500 }

export async function setListingGoodDeal(params: {
  listingId: string
  isGoodDeal: boolean
}): Promise<ListingGoodDealResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data: listing, error } = await service
    .from("listings")
    .select("id, section, status")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    console.error("setListingGoodDeal lookup:", {
      listingId: params.listingId,
      message: error.message,
    })
    return { ok: false, message: "Could not update deal badge", status: 500 }
  }
  if (!listing) {
    return { ok: false, message: "Listing not found", status: 404 }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, message: "Only surfboard listings can be marked as good deals", status: 400 }
  }
  if (listing.status !== "active") {
    return { ok: false, message: "Only active listings can be marked as good deals", status: 400 }
  }

  const result = await updateListingIsGoodDeal(service, params.listingId, params.isGoodDeal)
  if (!result.ok) {
    console.error("setListingGoodDeal update:", {
      listingId: params.listingId,
      message: result.message,
    })
    return { ok: false, message: "Could not update deal badge", status: 500 }
  }
  return result
}
