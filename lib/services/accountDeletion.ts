import type { User } from "@supabase/supabase-js"
import { deleteListingDocument } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateMarketplaceNewListingsFeed } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { createServiceRoleClient } from "@/lib/supabase/server"

const OPEN_ORDER_STATUSES = ["pending", "confirmed", "refunding"] as const

/**
 * Self-serve account deletion for App Store Guideline 5.1.1(v).
 * Removes login access and personal profile data. Orders and payment records
 * stay for legal/financial history with anonymized display identity.
 */
export async function deleteMemberAccountService(
  user: User,
): Promise<MobileApiResult<{ deleted: true }>> {
  const userId = user.id
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, status: 500, error: "Server configuration error." }
  }

  const { data: profile } = await service
    .from("profiles")
    .select("id, is_admin, display_name, seller_slug")
    .eq("id", userId)
    .maybeSingle()
  if (!profile) return { ok: false, status: 404, error: "Account not found." }
  if (profile.is_admin) {
    return { ok: false, status: 403, error: "Admin accounts can't be deleted from the app." }
  }

  const { count: openOrderCount, error: orderError } = await service
    .from("orders")
    .select("id", { count: "exact", head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in("status", [...OPEN_ORDER_STATUSES])
  if (orderError) {
    console.error("[accountDeletion] open orders:", orderError.message)
    return { ok: false, status: 500, error: "Couldn't verify your orders. Try again." }
  }
  if ((openOrderCount ?? 0) > 0) {
    return {
      ok: false,
      status: 409,
      error:
        "Finish or cancel open purchases and sales before deleting your account. Check Purchases and Sales.",
    }
  }

  const { data: wallet } = await service
    .from("wallets")
    .select("balance, pending_balance")
    .eq("user_id", userId)
    .maybeSingle()
  const available = Number(wallet?.balance ?? 0)
  const pending = Number(wallet?.pending_balance ?? 0)
  if (available > 0.009 || pending > 0.009) {
    return {
      ok: false,
      status: 409,
      error: "Cash out your earnings (and wait for pending payouts) before deleting your account.",
    }
  }

  const { data: liveListings } = await service
    .from("listings")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "draft", "pending", "pending_sale", "delinquent"])

  const listingIds = (liveListings ?? []).map((row) => row.id as string)
  if (listingIds.length > 0) {
    const { error: removeError } = await service
      .from("listings")
      .update({
        status: "removed",
        hidden_from_site: true,
        site_visibility_reason: "system",
      })
      .in("id", listingIds)
      .eq("user_id", userId)
    if (removeError) {
      console.error("[accountDeletion] listing remove failed:", removeError.message)
      return { ok: false, status: 500, error: "Couldn't close your listings. Try again." }
    }

    for (const listingId of listingIds) {
      try {
        await deleteListingDocument(listingId)
      } catch {
        // ES optional
      }
      try {
        await removeListingFromGoogleMerchantFeed(listingId)
      } catch {
        // optional
      }
    }
    revalidateBoardsBrowseCatalog()
    revalidateMarketplaceNewListingsFeed()
  }

  await service.from("cart_items").delete().eq("profile_id", userId)
  await service.from("seller_follows").delete().or(`follower_id.eq.${userId},seller_id.eq.${userId}`)
  await service.from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
  await service.from("device_push_tokens").delete().eq("user_id", userId)

  const tombstoneSlug = `deleted-${userId.replace(/-/g, "").slice(0, 12)}`
  const { error: profileError } = await service
    .from("profiles")
    .update({
      display_name: "Deleted account",
      bio: null,
      location: null,
      city: null,
      avatar_url: null,
      shop_logo_url: null,
      shop_banner_url: null,
      shop_tile_banner_url: null,
      seller_slug: tombstoneSlug,
      is_shop: false,
    })
    .eq("id", userId)
  if (profileError) {
    console.error("[accountDeletion] profile anonymize:", profileError.message)
    return { ok: false, status: 500, error: "Couldn't clear your profile. Try again." }
  }

  await revalidateSellersAfterListingChange(service, userId)

  const { error: deleteAuthError } = await service.auth.admin.deleteUser(userId)
  if (deleteAuthError) {
    console.warn("[accountDeletion] auth delete failed, banning instead:", deleteAuthError.message)
    const bannedEmail = `deleted+${userId.replace(/-/g, "")}@deleted.reswell.app`
    const { error: banError } = await service.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
      email: bannedEmail,
      email_confirm: true,
      user_metadata: {
        deleted: true,
        deleted_at: new Date().toISOString(),
      },
      app_metadata: { banned: true, deleted: true },
    })
    if (banError) {
      console.error("[accountDeletion] auth ban fallback:", banError.message)
      return {
        ok: false,
        status: 500,
        error: "Couldn't finish deleting the account. Contact support from Help.",
      }
    }
  }

  return { ok: true, data: { deleted: true } }
}
