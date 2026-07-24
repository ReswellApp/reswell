import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import {
  PEER_LISTING_SECTIONS_FILTER,
  isPeerListingSection,
} from "@/lib/peer-listing-sections"
import { isReswellShopListing, RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"
import { isListingPurchasable } from "@/lib/listing-public-visibility"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CheckoutCartListingRow = Record<string, unknown> & {
  id: string
  user_id: string
  section?: string | null
}

export type CheckoutCartLine = {
  listing: CheckoutCartListingRow
  quantity: number
}

/**
 * Loads peer listings for a seller plus all Reswell shop cart lines, in cart sort order.
 * When `sellerId` is the shop seller and the cart has only shop items, returns shop lines only.
 */
export async function fetchCheckoutCartListingsForSeller(
  supabase: SupabaseClient,
  buyerId: string,
  sellerId: string,
): Promise<{ lines: CheckoutCartLine[]; listings: CheckoutCartListingRow[] } | { error: string }> {
  if (!UUID_RE.test(buyerId.trim()) || !UUID_RE.test(sellerId.trim())) {
    return { error: "Invalid cart checkout parameters" }
  }

  const { data: cartRows, error: cartErr } = await supabase
    .from("cart_items")
    .select("listing_id, created_at, quantity")
    .eq("profile_id", buyerId.trim())
    .order("created_at", { ascending: false })

  if (cartErr) {
    return { error: cartErr.message }
  }

  const orderedCart = (cartRows ?? [])
    .map((r) => ({
      id: String((r as { listing_id?: string }).listing_id ?? "").trim(),
      quantity: Math.max(1, Math.floor(Number((r as { quantity?: number }).quantity) || 1)),
    }))
    .filter((r) => UUID_RE.test(r.id))

  if (orderedCart.length === 0) {
    return { lines: [], listings: [] }
  }

  const orderedIds = orderedCart.map((r) => r.id)
  const qtyById = new Map(orderedCart.map((r) => [r.id, r.quantity]))

  const { data: listingRows, error: listErr } = await supabase
    .from("listings")
    .select(
      `
      ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT},
      stock_quantity,
      slug,
      listing_images ( url, thumbnail_url, is_primary )
    `.trim(),
    )
    .in("id", orderedIds)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .in("section", [...PEER_LISTING_SECTIONS_FILTER, RESWELL_SHOP_SECTION])

  if (listErr || !listingRows) {
    return { error: listErr?.message ?? "Could not load listings" }
  }

  const byId = new Map<string, CheckoutCartListingRow>()
  for (const row of listingRows as unknown as CheckoutCartListingRow[]) {
    byId.set(row.id, row)
  }

  const seller = sellerId.trim()

  const lines: CheckoutCartLine[] = []
  for (const id of orderedIds) {
    const row = byId.get(id)
    if (!row) continue
    const section = String(row.section ?? "")
    if (isPeerListingSection(section)) {
      if (row.user_id !== seller) continue
      lines.push({ listing: row, quantity: 1 })
      continue
    }
    if (isReswellShopListing(section)) {
      const stock = Math.max(0, Math.floor(Number((row as { stock_quantity?: number }).stock_quantity) || 0))
      const qty = Math.min(qtyById.get(id) ?? 1, stock)
      if (qty < 1) continue
      // Always include Reswell shop cart lines (fulfilled by Reswell, any admin owner).
      lines.push({ listing: row, quantity: qty })
    }
  }

  return { lines, listings: lines.map((l) => l.listing) }
}

type CartJoinedListing = {
  user_id: string
  section: string | null
  status: string
  hidden_from_site?: boolean | null
  archived_at?: string | null
}

/**
 * Infer checkout seller: single peer seller if present; else Reswell shop seller when cart is shop-only.
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
        hidden_from_site,
        archived_at
      )
    `,
    )
    .eq("profile_id", buyerId.trim())

  if (error) {
    return { ok: false, reason: "query_error", message: error.message }
  }

  const peerSellers = new Set<string>()
  const shopSellers = new Set<string>()
  for (const row of data ?? []) {
    const raw = row as { listings?: CartJoinedListing | CartJoinedListing[] | null }
    const Lraw = raw.listings
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L?.user_id) continue
    const listing = {
      ...L,
      status: String(L.status ?? ""),
    }
    if (!isListingPurchasable(listing)) continue
    if (isPeerListingSection(String(listing.section ?? ""))) {
      peerSellers.add(listing.user_id)
    } else if (isReswellShopListing(listing.section)) {
      shopSellers.add(listing.user_id)
    }
  }

  if (peerSellers.size > 1) {
    return { ok: false, reason: "multi" }
  }
  if (peerSellers.size === 1) {
    return { ok: true, sellerId: [...peerSellers][0]! }
  }
  // Shop-only cart: Reswell-fulfilled (listing rows may be owned by different admins).
  if (shopSellers.size >= 1) {
    return { ok: true, sellerId: [...shopSellers][0]! }
  }
  return { ok: false, reason: "empty" }
}
