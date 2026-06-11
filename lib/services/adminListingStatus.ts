import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { updateAdminListingStatus } from "@/lib/db/listings"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import {
  removeListingFromGoogleMerchantFeed,
  syncListingToGoogleMerchantBestEffort,
} from "@/lib/services/googleMerchantSync"
import type { AdminListingStatus } from "@/lib/validations/admin-listing-status"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"

function shouldHideFromSite(status: AdminListingStatus): boolean {
  return status === "removed" || status === "draft"
}

function shouldRemoveFromPublicCatalog(status: AdminListingStatus): boolean {
  return status === "removed" || status === "draft"
}

export async function setAdminListingStatus(params: {
  listingIds: string[]
  status: AdminListingStatus
}): Promise<{ ok: true; updatedIds: string[] } | { ok: false; message: string }> {
  const listingIds = [...new Set(params.listingIds.map((id) => id.trim()).filter(Boolean))]
  if (listingIds.length === 0) {
    return { ok: false, message: "No listing ids provided" }
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured" }
  }

  const patch: {
    status: AdminListingStatus
    hidden_from_site?: boolean
  } = { status: params.status }
  if (shouldHideFromSite(params.status)) {
    patch.hidden_from_site = true
  }

  const updated = await updateAdminListingStatus(service, listingIds, patch)
  if (!updated.ok) {
    return updated
  }

  await applyListingStatusSideEffects(service, updated.updatedIds, params.status)

  return { ok: true, updatedIds: updated.updatedIds }
}

async function applyListingStatusSideEffects(
  supabase: SupabaseClient,
  listingIds: string[],
  status: AdminListingStatus,
): Promise<void> {
  const hideFromPublic = shouldRemoveFromPublicCatalog(status)

  await Promise.all(
    listingIds.map(async (listingId) => {
      try {
        await syncListingToIndex(supabase, listingId)
      } catch {
        // ES optional
      }

      if (hideFromPublic) {
        try {
          await removeListingFromGoogleMerchantFeed(listingId)
        } catch {
          // best-effort
        }
        try {
          await deleteAllCartRowsForListing(supabase, listingId)
        } catch {
          // best-effort
        }
      } else if (status === "active") {
        void syncListingToGoogleMerchantBestEffort(supabase, listingId)
      }
    }),
  )

  await revalidateAfterListingSiteModeration(supabase, listingIds)
}
