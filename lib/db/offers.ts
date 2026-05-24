import type { SupabaseClient } from "@supabase/supabase-js"

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
      "id, user_id, slug, title, price, status, section, hidden_from_site, buyer_offers_enabled, minimum_offer_pct, shipping_available, local_pickup, shipping_price, listing_images(url, thumbnail_url, is_primary)",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingRowForOffer
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
