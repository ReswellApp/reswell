import type { SupabaseClient } from "@supabase/supabase-js"
import { listStoresForStaffMember } from "@/lib/db/consignmentStores"
import { profileHasConsignmentShopRole } from "@/lib/services/consignmentShopAccess"

/** Personal dashboard / messages paths that consignment operators use under the store hub. */
export function isPersonalAccountDashboardPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/"
  return (
    normalized === "/dashboard" ||
    normalized.startsWith("/dashboard/") ||
    normalized === "/messages" ||
    normalized.startsWith("/messages/") ||
    normalized === "/offers" ||
    normalized.startsWith("/offers/")
  )
}

/**
 * Map a personal dashboard URL to the equivalent store account path.
 * Returns null when the path is not part of the personal account surface.
 */
export function mapPersonalPathToStoreAccountPath(
  storeSlug: string,
  pathname: string,
  search = "",
): string | null {
  const normalized = pathname.replace(/\/$/, "") || "/"
  const base = `/stores/${storeSlug}/account`

  const legacyTargets: Record<string, string> = {
    "/dashboard/wallet": `${base}/earnings`,
    "/dashboard/payouts": `${base}/earnings`,
    "/dashboard/earning": `${base}/earnings`,
    "/dashboard/followers": `${base}/following?tab=followers`,
  }
  if (legacyTargets[normalized]) {
    return legacyTargets[normalized]
  }

  if (normalized === "/dashboard") {
    return `${base}${search}`
  }

  if (normalized.startsWith("/dashboard/")) {
    const rest = normalized.slice("/dashboard".length)
    return `${base}${rest}${search}`
  }

  if (normalized === "/messages") {
    return `${base}/messages${search}`
  }

  if (normalized.startsWith("/messages/")) {
    const rest = normalized.slice("/messages".length)
    return `${base}/messages${rest}${search}`
  }

  if (normalized === "/offers") {
    return `${base}/offers${search}`
  }

  if (normalized.startsWith("/offers/")) {
    const rest = normalized.slice("/offers".length)
    return `${base}/offers${rest}${search}`
  }

  return null
}

/** Primary store slug for a consignment operator, if any. */
export async function getConsignmentOperatorPrimaryStoreSlug(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const granted = await profileHasConsignmentShopRole(supabase, profileId)
  if (!granted) return null

  const stores = await listStoresForStaffMember(supabase, profileId)
  return stores[0]?.store.slug ?? null
}

/**
 * When a consignment shop operator visits the personal dashboard, send them to the store hub account section.
 */
export async function resolveConsignmentOperatorAccountRedirect(
  supabase: SupabaseClient,
  profileId: string,
  pathname: string,
  search = "",
): Promise<string | null> {
  if (!isPersonalAccountDashboardPath(pathname)) return null

  const slug = await getConsignmentOperatorPrimaryStoreSlug(supabase, profileId)
  if (!slug) return null

  return mapPersonalPathToStoreAccountPath(slug, pathname, search)
}
