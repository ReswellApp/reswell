import type { SupabaseClient } from "@supabase/supabase-js"

export type OfferSettingsRow = {
  listing_id: string
  offers_enabled: boolean
  minimum_offer_pct: number
}

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
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
}

export async function fetchListingForOffer(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingRowForOffer | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, slug, title, price, status, section, hidden_from_site, buyer_offers_enabled, shipping_available, local_pickup, shipping_price",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingRowForOffer
}

export async function fetchOfferSettings(
  supabase: SupabaseClient,
  listingId: string,
): Promise<OfferSettingsRow | null> {
  const { data, error } = await supabase
    .from("offer_settings")
    .select("listing_id, offers_enabled, minimum_offer_pct")
    .eq("listing_id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as OfferSettingsRow
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
