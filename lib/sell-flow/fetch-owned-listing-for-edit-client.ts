import type { SupabaseClient } from "@supabase/supabase-js"

import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { getActiveImpersonationClient } from "@/lib/impersonation"
import { resolveSellEditUser } from "@/lib/sell-flow/resolve-sell-edit-user"

export type OwnedListingForEditClientResult = {
  userId: string
  listing: OwnedListingForEditRow
}

export type FetchOwnedListingForSellEditResult =
  | { ok: true; userId: string; listing: OwnedListingForEditRow }
  | { ok: false; reason: "unauthorized" | "not_found" }

const OWNED_EDIT_LISTING_SELECT = `
  *,
  listing_images (id, url, thumbnail_url, is_primary, sort_order),
  user_listing_board_model_data ( model_name, catalog_model_slug, catalog_brand_slug ),
  brand_models ( id, name, brands ( slug ) )
`

async function fetchOwnedListingViaApi(
  listingId: string,
): Promise<OwnedListingForEditClientResult | "unauthorized" | "not_found"> {
  try {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/owned-edit`, {
      credentials: "include",
      cache: "no-store",
    })
    if (res.status === 401) return "unauthorized"
    if (res.status === 404) return "not_found"
    if (!res.ok) return "not_found"
    const body = (await res.json()) as {
      data?: { userId?: string; listing?: OwnedListingForEditRow }
    }
    const userId = body.data?.userId?.trim()
    const listing = body.data?.listing
    if (!userId || !listing?.id) return "not_found"
    return { userId, listing }
  } catch {
    return "not_found"
  }
}

/**
 * Loads a seller-owned listing for /sell edit hydration. Uses the browser
 * Supabase client when available, otherwise falls back to a server-authenticated API
 * route (httpOnly SSR cookies are invisible to `document.cookie`).
 */
export async function fetchOwnedListingForSellEditClient(
  supabase: SupabaseClient,
  listingId: string,
): Promise<FetchOwnedListingForSellEditResult> {
  const trimmed = listingId.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const user = await resolveSellEditUser(supabase)
  if (user) {
    const imp = getActiveImpersonationClient()
    let query = supabase
      .from("listings")
      .select(OWNED_EDIT_LISTING_SELECT)
      .eq("id", trimmed)
    query = query.eq("user_id", imp?.userId ?? user.id)

    const { data: listing, error } = await query.single()
    if (!error && listing?.id) {
      return {
        ok: true,
        userId: String(listing.user_id ?? user.id),
        listing: listing as OwnedListingForEditRow,
      }
    }
  }

  const apiResult = await fetchOwnedListingViaApi(trimmed)
  if (apiResult === "unauthorized") return { ok: false, reason: "unauthorized" }
  if (apiResult === "not_found") {
    return { ok: false, reason: user ? "not_found" : "unauthorized" }
  }

  return {
    ok: true,
    userId: apiResult.userId,
    listing: apiResult.listing,
  }
}
