import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerBanState = {
  sellerBannedAt: string | null
  sellerBannedReason: string | null
}

export function isSellerBanActive(state: SellerBanState | null | undefined): boolean {
  return typeof state?.sellerBannedAt === "string" && state.sellerBannedAt.length > 0
}

export async function fetchSellerBanState(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellerBanState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("seller_banned_at, seller_banned_reason")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) {
    console.error("[fetchSellerBanState]", error?.message ?? "profile missing")
    return null
  }

  return {
    sellerBannedAt:
      typeof data.seller_banned_at === "string" ? data.seller_banned_at : null,
    sellerBannedReason:
      typeof data.seller_banned_reason === "string" ? data.seller_banned_reason : null,
  }
}

export async function setSellerBanForUser(
  supabase: SupabaseClient,
  userId: string,
  input: {
    bannedAt: string | null
    reason: string | null
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      seller_banned_at: input.bannedAt,
      seller_banned_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[setSellerBanForUser]", error.message)
    return false
  }

  return true
}

const DELINQUENT_SOURCE_STATUSES = ["active", "pending_sale", "pending"] as const

export async function markSellerListingsDelinquent(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; listingIds: string[] } | { ok: false; message: string }> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("listings")
    .update({
      status: "delinquent",
      hidden_from_site: true,
      site_visibility_reason: "seller_ban",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .in("status", [...DELINQUENT_SOURCE_STATUSES])
    .is("archived_at", null)
    .select("id")

  if (error) {
    console.error("[markSellerListingsDelinquent]", error.message)
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    listingIds: (data ?? []).map((row) => String((row as { id: string }).id)),
  }
}

export async function restoreSellerDelinquentListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true; listingIds: string[] } | { ok: false; message: string }> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("listings")
    .update({
      status: "active",
      hidden_from_site: false,
      site_visibility_reason: null,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("status", "delinquent")
    .is("archived_at", null)
    .select("id")

  if (error) {
    console.error("[restoreSellerDelinquentListings]", error.message)
    return { ok: false, message: error.message }
  }

  return {
    ok: true,
    listingIds: (data ?? []).map((row) => String((row as { id: string }).id)),
  }
}
