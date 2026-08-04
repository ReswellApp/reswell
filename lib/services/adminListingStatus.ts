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
import { recordListingVisibilityEvents } from "@/lib/services/listingVisibilityAudit"

function shouldHideFromSite(status: AdminListingStatus): boolean {
  return status === "removed" || status === "draft" || status === "delinquent"
}

function shouldRemoveFromPublicCatalog(status: AdminListingStatus): boolean {
  return status === "removed" || status === "draft" || status === "delinquent"
}

export async function setAdminListingStatus(params: {
  listingIds: string[]
  status: AdminListingStatus
  actorUserId?: string | null
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

  const { data: priorRows } = await service
    .from("listings")
    .select("id, user_id, hidden_from_site")
    .in("id", listingIds)

  const priorHidden = new Map<string, boolean>()
  const ownerIds = new Set<string>()
  for (const row of priorRows ?? []) {
    const id = String((row as { id: string }).id)
    priorHidden.set(id, Boolean((row as { hidden_from_site?: boolean | null }).hidden_from_site))
    const ownerId = (row as { user_id?: string | null }).user_id
    if (typeof ownerId === "string" && ownerId.length > 0) ownerIds.add(ownerId)
  }

  if (params.status === "active" && ownerIds.size > 0) {
    const { data: bannedOwners, error: banErr } = await service
      .from("profiles")
      .select("id")
      .in("id", [...ownerIds])
      .not("seller_banned_at", "is", null)

    if (banErr) {
      console.error("[setAdminListingStatus] seller ban lookup:", banErr.message)
      return { ok: false, message: "Could not verify seller ban status" }
    }
    if ((bannedOwners ?? []).length > 0) {
      return {
        ok: false,
        message:
          "Cannot make listings live while the seller is banned. Remove the seller ban first.",
      }
    }
  }

  const patch: {
    status: AdminListingStatus
    hidden_from_site?: boolean
    site_visibility_reason?: "admin_status" | "seller_ban" | null
  } = { status: params.status }
  if (params.status === "delinquent") {
    patch.hidden_from_site = true
    patch.site_visibility_reason = "seller_ban"
  } else if (shouldHideFromSite(params.status)) {
    patch.hidden_from_site = true
    patch.site_visibility_reason = "admin_status"
  } else if (params.status === "active") {
    // Restoring live inventory must clear site hide (removed/draft/vacation leftovers).
    patch.hidden_from_site = false
    patch.site_visibility_reason = null
  }

  const updated = await updateAdminListingStatus(service, listingIds, patch)
  if (!updated.ok) {
    return updated
  }

  if (patch.hidden_from_site !== undefined) {
    const nextHidden = patch.hidden_from_site
    const auditInputs = updated.updatedIds
      .filter((id) => priorHidden.get(id) !== nextHidden)
      .map((listingId) => ({
        listingId,
        hiddenFromSite: nextHidden,
        source: "admin_status" as const,
        actorUserId: params.actorUserId,
        metadata: { status: params.status },
      }))
    await recordListingVisibilityEvents(service, auditInputs)
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
