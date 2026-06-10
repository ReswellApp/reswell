import type { SupabaseClient } from "@supabase/supabase-js"
import type { GoogleMerchantListingRow } from "@/lib/google-merchant/map-listing-to-product-input"

const GOOGLE_MERCHANT_LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  price,
  condition,
  brand,
  model,
  section,
  status,
  hidden_from_site,
  archived_at,
  excluded_from_google_merchant,
  shipping_available,
  shipping_price,
  board_shipping_cost_mode,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`

export async function getGoogleMerchantListingById(
  supabase: SupabaseClient,
  listingId: string,
): Promise<GoogleMerchantListingRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(GOOGLE_MERCHANT_LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as GoogleMerchantListingRow
}

export async function listGoogleMerchantListingBatch(
  supabase: SupabaseClient,
  options: { from: number; limit: number },
): Promise<GoogleMerchantListingRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(GOOGLE_MERCHANT_LISTING_SELECT)
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(options.from, options.from + options.limit - 1)

  if (error || !data) return []
  return data as unknown as GoogleMerchantListingRow[]
}
