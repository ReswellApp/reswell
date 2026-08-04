import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import {
  fetchSellerBanState,
  isSellerBanActive,
  markSellerListingsDelinquent,
  restoreSellerDelinquentListings,
  setSellerBanForUser,
  type SellerBanState,
} from "@/lib/db/sellerBan"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import { recordListingVisibilityEvents } from "@/lib/services/listingVisibilityAudit"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateSellersForUserIds } from "@/lib/cache/revalidate-sellers-directory-catalog"
import {
  SELLER_BANNED_ERROR,
  SELLER_BANNED_USER_MESSAGE,
} from "@/lib/messages/seller-ban-errors"

export { SELLER_BANNED_USER_MESSAGE }

export type SellerSellGuardResult =
  | { ok: true }
  | { ok: false; error: typeof SELLER_BANNED_ERROR; userMessage: string; sellerBannedAt: string }

export async function evaluateSellerCanSell(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellerSellGuardResult> {
  const state = await fetchSellerBanState(supabase, userId)
  if (!state || !isSellerBanActive(state) || !state.sellerBannedAt) {
    return { ok: true }
  }

  return {
    ok: false,
    error: SELLER_BANNED_ERROR,
    userMessage: SELLER_BANNED_USER_MESSAGE,
    sellerBannedAt: state.sellerBannedAt,
  }
}

export type AdminSellerBanResult =
  | {
      ok: true
      banned: boolean
      sellerBannedAt: string | null
      sellerBannedReason: string | null
      affectedListingIds: string[]
    }
  | { ok: false; error: string }

async function getServiceClient(): Promise<
  | { ok: true; service: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, service: createServiceRoleClient() }
  } catch {
    return { ok: false, error: "Server configuration error." }
  }
}

export async function loadAdminSellerBan(userId: string): Promise<
  | { ok: true; state: SellerBanState }
  | { ok: false; error: string }
> {
  const client = await getServiceClient()
  if (!client.ok) return client

  const state = await fetchSellerBanState(client.service, userId)
  if (!state) {
    return { ok: false, error: "User not found." }
  }

  return { ok: true, state }
}

export async function applyAdminSellerBan(input: {
  userId: string
  banned: boolean
  reason: string | null
  actorUserId?: string | null
}): Promise<AdminSellerBanResult> {
  const client = await getServiceClient()
  if (!client.ok) return client
  const service = client.service

  const { data: profile, error: profileErr } = await service
    .from("profiles")
    .select("id, is_admin")
    .eq("id", input.userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[applyAdminSellerBan] profile lookup:", profileErr.message)
    return { ok: false, error: "Could not load user." }
  }
  if (!profile) {
    return { ok: false, error: "User not found." }
  }
  if (profile.is_admin === true && input.banned) {
    return { ok: false, error: "Admin accounts cannot be seller-banned." }
  }

  if (input.banned) {
    const bannedAt = new Date().toISOString()
    const banOk = await setSellerBanForUser(service, input.userId, {
      bannedAt,
      reason: input.reason,
    })
    if (!banOk) {
      return { ok: false, error: "Could not update seller ban." }
    }

    const marked = await markSellerListingsDelinquent(service, input.userId)
    if (!marked.ok) {
      return { ok: false, error: "Seller ban saved, but listings could not be updated." }
    }

    if (marked.listingIds.length > 0) {
      await recordListingVisibilityEvents(
        service,
        marked.listingIds.map((listingId) => ({
          listingId,
          hiddenFromSite: true,
          source: "seller_ban" as const,
          actorUserId: input.actorUserId ?? null,
          note: "Seller ban — listings moved to delinquent",
          metadata: { status: "delinquent" },
        })),
      )

      await Promise.all(
        marked.listingIds.map(async (listingId) => {
          try {
            await deleteAllCartRowsForListing(service, listingId)
          } catch {
            // best-effort
          }
          try {
            await removeListingFromGoogleMerchantFeed(listingId)
          } catch {
            // best-effort
          }
          try {
            await syncListingToIndex(service, listingId)
          } catch {
            // ES optional
          }
        }),
      )

      await revalidateAfterListingSiteModeration(service, marked.listingIds)
      revalidateBoardsBrowseCatalog()
      await revalidateSellersForUserIds(service, [input.userId])
    }

    return {
      ok: true,
      banned: true,
      sellerBannedAt: bannedAt,
      sellerBannedReason: input.reason,
      affectedListingIds: marked.listingIds,
    }
  }

  // Unban first so the listings trigger allows restore to active.
  const clearOk = await setSellerBanForUser(service, input.userId, {
    bannedAt: null,
    reason: null,
  })
  if (!clearOk) {
    return { ok: false, error: "Could not remove seller ban." }
  }

  const restored = await restoreSellerDelinquentListings(service, input.userId)
  if (!restored.ok) {
    return { ok: false, error: "Seller ban removed, but listings could not be restored." }
  }

  if (restored.listingIds.length > 0) {
    await recordListingVisibilityEvents(
      service,
      restored.listingIds.map((listingId) => ({
        listingId,
        hiddenFromSite: false,
        source: "seller_ban" as const,
        actorUserId: input.actorUserId ?? null,
        note: "Seller ban removed — delinquent listings restored",
        metadata: { status: "active" },
      })),
    )

    await Promise.all(
      restored.listingIds.map(async (listingId) => {
        try {
          await syncListingToIndex(service, listingId)
        } catch {
          // ES optional
        }
      }),
    )

    await revalidateAfterListingSiteModeration(service, restored.listingIds)
    revalidateBoardsBrowseCatalog()
    await revalidateSellersForUserIds(service, [input.userId])
  }

  return {
    ok: true,
    banned: false,
    sellerBannedAt: null,
    sellerBannedReason: null,
    affectedListingIds: restored.listingIds,
  }
}
