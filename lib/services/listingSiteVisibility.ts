import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { updateListingHiddenFromSite } from "@/lib/db/listings"
import type { ListingVisibilitySource } from "@/lib/listing-visibility-sources"
import { recordListingVisibilityEvent } from "@/lib/services/listingVisibilityAudit"

export async function setListingSiteVisibility(params: {
  listingId: string
  hiddenFromSite: boolean
  source?: ListingVisibilitySource
  actorUserId?: string | null
  note?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; message: string }> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const { data: existing, error: loadError } = await service
    .from("listings")
    .select("id, hidden_from_site")
    .eq("id", params.listingId)
    .maybeSingle()

  if (loadError) {
    return { ok: false, message: loadError.message }
  }
  if (!existing) {
    return { ok: false, message: "Listing not found" }
  }

  const already = Boolean(existing.hidden_from_site) === params.hiddenFromSite
  if (already) {
    return { ok: true }
  }

  const source = params.source ?? "admin_site_visibility"
  const result = await updateListingHiddenFromSite(
    service,
    params.listingId,
    params.hiddenFromSite,
    { source },
  )
  if (!result.ok) {
    return result
  }

  await recordListingVisibilityEvent(service, {
    listingId: params.listingId,
    hiddenFromSite: params.hiddenFromSite,
    source,
    actorUserId: params.actorUserId,
    note: params.note,
    metadata: params.metadata,
  })

  if (params.hiddenFromSite) {
    try {
      await deleteAllCartRowsForListing(service, params.listingId)
    } catch {
      // best-effort
    }
  }

  return { ok: true }
}
