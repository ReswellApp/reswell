import type { SupabaseClient } from "@supabase/supabase-js"
import type { AccountPermission } from "@/lib/account-access/permissions"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { getShopAccountContext } from "@/lib/services/accountAccess"
import { createServiceRoleClient } from "@/lib/supabase/server"

export interface ManagedSeller {
  actorUserId: string
  actorEmail: string | null
  sellerId: string
  actingAsShop: boolean
}

export type ManagedSellerResult =
  | { ok: true; seller: ManagedSeller }
  | { ok: false; error: string; status: 401 | 403 }

/**
 * The account this login is operating. Personal mode is their own profile.
 * Inside a shop, the shop id is used only when that role has the permission.
 */
export async function resolveManagedSeller(
  permission: AccountPermission,
): Promise<ManagedSellerResult> {
  const shop = await getShopAccountContext()
  if (!shop) return { ok: false, error: "Please sign in.", status: 401 }
  if (!shop.permissions.has(permission)) {
    return { ok: false, error: "You don't have access to that.", status: 403 }
  }
  return {
    ok: true,
    seller: {
      actorUserId: shop.actorUserId,
      actorEmail: shop.actorEmail,
      sellerId: shop.accountId,
      actingAsShop: shop.actingAsShop,
    },
  }
}

/**
 * Writes for the account this login is operating. A shop row is written with
 * the service role after the permission check, and only the columns the caller
 * sets. The teammate's session still cannot update another profile.
 */
export async function resolveManagedProfileWriter(
  permission: AccountPermission = "profile.manage",
): Promise<
  | { ok: true; supabase: SupabaseClient; userId: string; actingAsShop: boolean }
  | { ok: false; error: string; status: number }
> {
  const managed = await resolveManagedSeller(permission)
  if (!managed.ok) return managed
  if (!managed.seller.actingAsShop) {
    const { supabase, user } = await resolveServerAuth()
    if (!user) return { ok: false, error: "Please sign in.", status: 401 }
    return { ok: true, supabase, userId: user.id, actingAsShop: false }
  }
  try {
    return {
      ok: true,
      supabase: createServiceRoleClient(),
      userId: managed.seller.sellerId,
      actingAsShop: true,
    }
  } catch {
    return { ok: false, error: "Could not update this shop right now.", status: 503 }
  }
}
