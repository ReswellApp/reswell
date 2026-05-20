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
  section,
  status,
  hidden_from_site,
  listing_images ( url, thumbnail_url, is_primary )
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
    .order("created_at", { ascending: false })
    .range(options.from, options.from + options.limit - 1)

  if (error || !data) return []
  return data as unknown as GoogleMerchantListingRow[]
}
