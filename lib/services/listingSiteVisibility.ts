import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { updateListingHiddenFromSite } from "@/lib/db/listings"

export async function setListingSiteVisibility(params: {
  listingId: string
  hiddenFromSite: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const result = await updateListingHiddenFromSite(
    service,
    params.listingId,
    params.hiddenFromSite,
  )
  if (!result.ok) {
    return result
  }

  if (params.hiddenFromSite) {
    try {
      await deleteAllCartRowsForListing(service, params.listingId)
    } catch {
      // best-effort
    }
  }

  return { ok: true }
}
