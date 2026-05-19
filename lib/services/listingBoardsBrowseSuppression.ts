import { createServiceRoleClient } from "@/lib/supabase/server"
import { updateListingSuppressedOnBoardsBrowse } from "@/lib/db/listings"

export async function setListingBoardsBrowseSuppression(params: {
  listingId: string
  suppressed: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const { data: listing, error } = await service
    .from("listings")
    .select("id, section, status")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!listing) {
    return { ok: false, message: "Listing not found" }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, message: "Only surfboard listings can be suppressed on /boards" }
  }
  if (listing.status !== "active") {
    return { ok: false, message: "Only active listings can be suppressed on /boards" }
  }

  return updateListingSuppressedOnBoardsBrowse(service, params.listingId, params.suppressed)
}
