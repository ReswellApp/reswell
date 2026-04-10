import { createServiceRoleClient } from "@/lib/supabase/server"
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

  return updateListingHiddenFromSite(service, params.listingId, params.hiddenFromSite)
}
