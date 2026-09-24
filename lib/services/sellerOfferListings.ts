import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchSellerListingsForOffer,
  listOpenOffersBetweenBuyerAndSeller,
  type ListingRowForOffer,
} from "@/lib/db/offers"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import type { SellerOfferListing } from "@/lib/types/seller-offer-listing"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import { latestSellerCounterNoteFromTimeline } from "@/lib/utils/offer-timeline"
import { lineItemListingIdsFromRaw } from "@/lib/utils/seller-offer-revision"

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

export type OpenSellerOfferPreview = {
  id: string
  fulfillment: "pickup" | "shipping" | null
  message: string | null
  lineItems: { listingId: string; amount: number }[]
}

export type ListSellerOfferListingsResult =
  | { ok: true; listings: SellerOfferListing[]; openOffer: OpenSellerOfferPreview | null }
  | { ok: false; status: number; error: string }

async function openSellerOfferForBuyer(
  supabase: SupabaseClient,
  sellerUserId: string,
  buyerUserId: string,
  anchorListingId: string,
): Promise<OpenSellerOfferPreview | null> {
  const rows = await listOpenOffersBetweenBuyerAndSeller(supabase, buyerUserId, sellerUserId)
  const matches = rows
    .filter((row) => row.seller_initiated === true && row.status === "COUNTERED")
    .filter((row) => {
      const ids = new Set([row.listing_id, ...lineItemListingIdsFromRaw(row.line_items)])
      return ids.has(anchorListingId)
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const open = matches[0]
  if (!open) return null

  const parsed = parseOfferLineItems(open.line_items)
  const lineItems =
    parsed && parsed.length > 0
      ? parsed.map((item) => ({ listingId: item.listing_id, amount: item.amount }))
      : [{ listingId: open.listing_id, amount: 0 }]

  const fulfillment = open.fulfillment === "pickup" || open.fulfillment === "shipping" ? open.fulfillment : null

  return {
    id: open.id,
    fulfillment,
    message: latestSellerCounterNoteFromTimeline(open.offer_timeline),
    lineItems: lineItems.filter((item) => item.amount > 0),
  }
}

export async function listSellerOfferListings(
  supabase: SupabaseClient,
  sellerUserId: string,
  anchorListingId: string,
  options?: { anchorOnly?: boolean; buyerUserId?: string },
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

    const openOffer = options?.buyerUserId
      ? await openSellerOfferForBuyer(supabase, sellerUserId, options.buyerUserId, anchorListingId)
      : null

    return { ok: true, listings, openOffer }
  } catch (error) {
    console.error("[listSellerOfferListings]", error)
    return { ok: false, status: 500, error: "Could not load your listings." }
  }
}
