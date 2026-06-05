import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import {
  PEER_LISTING_SECTIONS_FILTER,
  isPeerListingSection,
} from "@/lib/peer-listing-sections"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CheckoutCartListingRow = Record<string, unknown> & {
  id: string
  user_id: string
}

/**
 * Loads surfboard listings from the buyer's cart for a specific seller, in cart sort order (newest cart row first).
 */
export async function fetchCheckoutCartListingsForSeller(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<{ listings: CheckoutCartListingRow[] } | { error: string }> {
  if (!UUID_RE.test(buyerId.trim()) || !UUID_RE.test(sellerId.trim())) {
    return { error: "Invalid cart checkout parameters" }
  }

  const { data: cartRows, error: cartErr } = await supabase
    .from("cart_items")
    .select("listing_id, created_at")
    .eq("profile_id", buyerId.trim())
    .order("created_at", { ascending: false })

  if (cartErr) {
    return { error: cartErr.message }
  }

  const orderedIds = (cartRows ?? [])
    .map((r) => String((r as { listing_id?: string }).listing_id ?? "").trim())
    .filter((id) => UUID_RE.test(id))

  if (orderedIds.length === 0) {
    return { listings: [] }
  }

  const { data: listingRows, error: listErr } = await supabase
    .from("listings")
    .select(
      `
      ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT},
      slug,
      listing_images ( url, thumbnail_url, is_primary )
    `.trim(),
    )
    .in("id", orderedIds)
    .eq("user_id", sellerId.trim())
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .in("section", PEER_LISTING_SECTIONS_FILTER)

  if (listErr || !listingRows) {
    return { error: listErr?.message ?? "Could not load listings" }
  }

  const byId = new Map<string, CheckoutCartListingRow>()
  for (const row of listingRows as unknown as CheckoutCartListingRow[]) {
    byId.set(row.id, row)
  }

  const listings: CheckoutCartListingRow[] = []
  for (const id of orderedIds) {
    const row = byId.get(id)
    if (row) listings.push(row)
  }

  return { listings }
}

type CartJoinedListing = {
  user_id: string
  section: string | null
  status: string | null
  hidden_from_site?: boolean | null
}

/**
 * When `/checkout?from_cart=1` omits `seller_id`, infer it only if every cart surfboard eligible for checkout shares one seller.
 */
export async function inferPeerCartSellerIdFromBuyerCart(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<
  | { ok: true; sellerId: string }
  | { ok: false; reason: "empty" | "multi" | "query_error"; message?: string }
> {
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      listings!inner (
        user_id,
        section,
        status,
        hidden_from_site
      )
    `,
    )
    .eq("profile_id", buyerId.trim())

  if (error) {
    return { ok: false, reason: "query_error", message: error.message }
  }

  const sellers = new Set<string>()
  for (const row of data ?? []) {
    const raw = row as { listings?: CartJoinedListing | CartJoinedListing[] | null }
    const Lraw = raw.listings
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L?.user_id) continue
    if (!isPeerListingSection(String(L.section ?? ""))) continue
    if (L.status !== "active" && L.status !== "pending_sale") continue
    if (L.hidden_from_site) continue
    sellers.add(L.user_id)
  }

  if (sellers.size === 0) {
    return { ok: false, reason: "empty" }
  }
  if (sellers.size > 1) {
    return { ok: false, reason: "multi" }
  }

  return { ok: true, sellerId: [...sellers][0]! }
}
