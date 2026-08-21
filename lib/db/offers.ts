import type { SupabaseClient } from "@supabase/supabase-js"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"

const SELLER_OFFER_LISTING_SELECT =
  "id, user_id, slug, title, price, status, section, hidden_from_site, buyer_offers_enabled, minimum_offer_pct, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode, listing_images(url, thumbnail_url, is_primary)"

const SELLER_OFFER_LISTING_SELECT_NO_IMAGES =
  "id, user_id, slug, title, price, status, section, hidden_from_site, buyer_offers_enabled, minimum_offer_pct, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode"

const SELLER_OFFER_BUNDLE_LIMIT = 40

export type ListingRowForOffer = {
  id: string
  user_id: string
  slug: string | null
  title: string | null
  price: string | number
  status: string
  section: string
  hidden_from_site: boolean | null
  buyer_offers_enabled: boolean | null
  minimum_offer_pct: number | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
  board_shipping_cost_mode?: string | null
  listing_images?: {
    url: string
    thumbnail_url?: string | null
    is_primary?: boolean | null
  }[] | null
}

export async function fetchListingForOffer(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingRowForOffer | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, slug, title, price, status, section, hidden_from_site, buyer_offers_enabled, minimum_offer_pct, shipping_available, local_pickup, shipping_price, board_shipping_cost_mode, listing_images(url, thumbnail_url, is_primary)",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingRowForOffer
}

function asListingRowForOffer(row: unknown): ListingRowForOffer | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== "string") return null
  return row as ListingRowForOffer
}

async function fetchOwnedListingForOffer(
  supabase: SupabaseClient,
  sellerUserId: string,
  listingId: string,
): Promise<ListingRowForOffer | null> {
  const withImages = await supabase
    .from("listings")
    .select(SELLER_OFFER_LISTING_SELECT)
    .eq("id", listingId)
    .eq("user_id", sellerUserId)
    .maybeSingle()

  if (!withImages.error) {
    const listing = asListingRowForOffer(withImages.data)
    if (listing) return listing
  } else {
    console.error("[fetchOwnedListingForOffer] with images:", withImages.error.message)
  }

  const plain = await supabase
    .from("listings")
    .select(SELLER_OFFER_LISTING_SELECT_NO_IMAGES)
    .eq("id", listingId)
    .eq("user_id", sellerUserId)
    .maybeSingle()

  if (plain.error) {
    console.error("[fetchOwnedListingForOffer] without images:", plain.error.message)
    return null
  }

  return asListingRowForOffer(plain.data)
}

/**
 * Seller’s offerable listings for a seller-initiated offer.
 * Always includes the current listing when the owner can still offer on it,
 * even if the catalog query fails (large image embeds, etc.).
 */
export async function fetchSellerListingsForOffer(
  supabase: SupabaseClient,
  sellerUserId: string,
  anchorListingId: string,
  options?: { anchorOnly?: boolean },
): Promise<ListingRowForOffer[]> {
  const byId = new Map<string, ListingRowForOffer>()

  if (!options?.anchorOnly) {
    const catalogQuery = (select: string) =>
      supabase
        .from("listings")
        .select(select)
        .eq("user_id", sellerUserId)
        .in("section", PEER_LISTING_SECTIONS_FILTER)
        .in("status", ["active", "pending_sale"])
        .order("created_at", { ascending: false })
        .limit(SELLER_OFFER_BUNDLE_LIMIT)

    const listRes = await catalogQuery(SELLER_OFFER_LISTING_SELECT)
    let catalogRows = listRes.data ?? []
    if (listRes.error) {
      console.error("[fetchSellerListingsForOffer] catalog:", listRes.error.message)
      const fallbackCatalog = await catalogQuery(SELLER_OFFER_LISTING_SELECT_NO_IMAGES)
      if (fallbackCatalog.error) {
        console.error(
          "[fetchSellerListingsForOffer] catalog without images:",
          fallbackCatalog.error.message,
        )
      } else {
        catalogRows = fallbackCatalog.data ?? []
      }
    }

    for (const row of catalogRows) {
      const listing = asListingRowForOffer(row)
      if (!listing) continue
      if (listing.hidden_from_site === true) continue
      if (listing.buyer_offers_enabled === false && listing.id !== anchorListingId) continue
      byId.set(listing.id, listing)
    }
  }

  const anchor = await fetchOwnedListingForOffer(supabase, sellerUserId, anchorListingId)
  if (anchor && anchor.hidden_from_site !== true) {
    byId.set(anchor.id, anchor)
  }

  return [...byId.values()]
}

export async function findPendingOfferForBuyer(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("status", "PENDING")
    .maybeSingle()

  if (error || !data) return null
  return { id: data.id }
}

/** Buyer–seller offer row where the buyer may check out at `current_amount` (listing stays `active`). */
export type AcceptedOfferPricingRow = {
  id: string
  current_amount: string | number
  seller_id: string
}

export async function fetchAcceptedOfferForBuyerListing(
  supabase: SupabaseClient,
  buyerId: string,
  listingId: string,
): Promise<AcceptedOfferPricingRow | null> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, current_amount, seller_id")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyerId)
    .eq("status", "ACCEPTED")
    .maybeSingle()

  if (error || !data) return null
  return data as AcceptedOfferPricingRow
}
