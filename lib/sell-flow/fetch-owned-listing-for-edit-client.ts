import type { SupabaseClient } from "@supabase/supabase-js"

import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { getActiveImpersonationClient } from "@/lib/impersonation"

export type OwnedListingForEditClientResult = {
  userId: string
  listing: OwnedListingForEditRow
}

export type FetchOwnedListingForSellEditResult =
  | { ok: true; userId: string; listing: OwnedListingForEditRow }
  | { ok: false; reason: "unauthorized" | "not_found" | "timeout" | "error" }

const OWNED_EDIT_LISTING_SELECT = `
  *,
  listing_images (id, url, thumbnail_url, is_primary, sort_order),
  user_listing_board_model_data ( model_name, catalog_model_slug, catalog_brand_slug ),
  brand_models ( id, name, brands ( slug ) )
`

const OWNED_EDIT_FETCH_TIMEOUT_MS = 12_000

async function fetchOwnedListingViaApi(
  listingId: string,
  signal?: AbortSignal,
): Promise<OwnedListingForEditClientResult | "unauthorized" | "not_found" | "timeout" | "error"> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), OWNED_EDIT_FETCH_TIMEOUT_MS)

  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      globalThis.clearTimeout(timeoutId)
      return "error"
    }
    signal.addEventListener("abort", onExternalAbort, { once: true })
  }

  try {
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/owned-edit`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
    if (res.status === 401) return "unauthorized"
    if (res.status === 404) return "not_found"
    if (!res.ok) return "error"
    const body = (await res.json()) as {
      data?: { userId?: string; listing?: OwnedListingForEditRow }
    }
    const userId = body.data?.userId?.trim()
    const listing = body.data?.listing
    if (!userId || !listing?.id) return "not_found"
    return { userId, listing }
  } catch {
    if (controller.signal.aborted && !signal?.aborted) return "timeout"
    return "error"
  } finally {
    globalThis.clearTimeout(timeoutId)
    signal?.removeEventListener("abort", onExternalAbort)
  }
}

/**
 * Fast path: use the browser Supabase client only when a session is already warm.
 * Never polls for session readiness — that path can hang edit hydration for many seconds
 * when auth cookies are httpOnly.
 */
async function fetchOwnedListingViaWarmClient(
  supabase: SupabaseClient,
  listingId: string,
): Promise<OwnedListingForEditClientResult | null> {
  if (getActiveImpersonationClient()) return null

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user?.id || !session?.access_token) return null

    const { data: listing, error } = await supabase
      .from("listings")
      .select(OWNED_EDIT_LISTING_SELECT)
      .eq("id", listingId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !listing?.id) return null
    return {
      userId: String(listing.user_id ?? user.id),
      listing: listing as OwnedListingForEditRow,
    }
  } catch {
    return null
  }
}

/**
 * Loads a seller-owned listing for /sell edit hydration.
 * Prefers the server-authenticated owned-edit API (works with httpOnly SSR cookies).
 * Falls back to a warm browser-session Supabase query only on transient API failure.
 * Never polls for session readiness.
 */
export async function fetchOwnedListingForSellEditClient(
  supabase: SupabaseClient,
  listingId: string,
  options?: { signal?: AbortSignal },
): Promise<FetchOwnedListingForSellEditResult> {
  const trimmed = listingId.trim()
  if (!trimmed) return { ok: false, reason: "not_found" }

  const signal = options?.signal
  if (signal?.aborted) return { ok: false, reason: "error" }

  const apiResult = await fetchOwnedListingViaApi(trimmed, signal)
  if (apiResult === "unauthorized") return { ok: false, reason: "unauthorized" }
  if (apiResult === "not_found") return { ok: false, reason: "not_found" }
  if (apiResult !== "timeout" && apiResult !== "error") {
    return {
      ok: true,
      userId: apiResult.userId,
      listing: apiResult.listing,
    }
  }

  if (signal?.aborted) return { ok: false, reason: "error" }

  /** Impersonation must not use the browser client — RLS blocks cross-user reads. */
  if (!getActiveImpersonationClient()) {
    const warm = await fetchOwnedListingViaWarmClient(supabase, trimmed)
    if (warm) {
      return {
        ok: true,
        userId: warm.userId,
        listing: warm.listing,
      }
    }
  }

  return { ok: false, reason: apiResult }
}
