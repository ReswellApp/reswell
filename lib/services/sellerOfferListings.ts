import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSellerListingsForOffer, type ListingRowForOffer } from "@/lib/db/offers"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import type { SellerOfferListing } from "@/lib/types/seller-offer-listing"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function listingImages(row: ListingRowForOffer): ListingImageForCard[] | null {
  const images = row.listing_images
  if (!Array.isArray(images) || images.length === 0) return null
  return images
}

function mapSellerOfferListing(row: ListingRowForOffer): SellerOfferListing | null {
  const price = roundMoney(parseFloat(String(row.price ?? 0)))
  if (!Number.isFinite(price) || price <= 0) return null
  if (row.status !== "active" && row.status !== "pending_sale") return null
  if (!isPeerListingSection(row.section)) return null

  const mode = row.board_shipping_cost_mode
  const boardShippingCostMode =
    mode === "reswell" || mode === "flat" || mode === "free" ? mode : null

  return {
    id: row.id,
    title: row.title ?? null,
    section: row.section,
    price,
    minimum_offer_pct: row.minimum_offer_pct ?? null,
    shipping_available: row.shipping_available ?? null,
    local_pickup: row.local_pickup ?? null,
    shipping_price:
      row.shipping_price != null ? roundMoney(parseFloat(String(row.shipping_price))) : null,
    board_shipping_cost_mode: boardShippingCostMode,
    listing_images: listingImages(row),
  }
}

export type ListSellerOfferListingsResult =
  | { ok: true; listings: SellerOfferListing[] }
  | { ok: false; status: number; error: string }

export async function listSellerOfferListings(
  supabase: SupabaseClient,
  sellerUserId: string,
  anchorListingId: string,
  options?: { anchorOnly?: boolean },
): Promise<ListSellerOfferListingsResult> {
  try {
    const rows = await fetchSellerListingsForOffer(
      supabase,
      sellerUserId,
      anchorListingId,
      options,
    )
    const listings: SellerOfferListing[] = []
    let hasAnchor = false

    for (const row of rows) {
      const mapped = mapSellerOfferListing(row)
      if (!mapped) continue
      listings.push(mapped)
      if (mapped.id === anchorListingId) hasAnchor = true
    }

    if (!hasAnchor) {
      return {
        ok: false,
        status: 404,
        error: "This listing is not available for an offer right now.",
      }
    }

    listings.sort((a, b) => {
      if (a.id === anchorListingId) return -1
      if (b.id === anchorListingId) return 1
      return 0
    })

    return { ok: true, listings }
  } catch (error) {
    console.error("[listSellerOfferListings]", error)
    return { ok: false, status: 500, error: "Could not load your listings." }
  }
}
