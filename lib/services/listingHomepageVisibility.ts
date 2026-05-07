import { createServiceRoleClient } from "@/lib/supabase/server"
import { updateListingHiddenFromHomepage } from "@/lib/db/listings"

export async function setListingHomepageVisibility(params: {
  listingId: string
  hiddenFromHomepage: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  return updateListingHiddenFromHomepage(service, params.listingId, params.hiddenFromHomepage)
}
