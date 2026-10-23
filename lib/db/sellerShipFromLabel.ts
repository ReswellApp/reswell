import type { SupabaseClient } from "@supabase/supabase-js"

/** ShipEngine / carriers tolerate long names; keep a sane cap for label layout. */
const MAX_SHIP_FROM_NAME_LEN = 80

function truncateShipFromName(s: string): string {
  const t = s.trim()
  if (t.length <= MAX_SHIP_FROM_NAME_LEN) return t
  return `${t.slice(0, MAX_SHIP_FROM_NAME_LEN - 1).trimEnd()}…`
}

/**
 * Line printed as ship-from contact on carrier labels.
 * The seller-chosen label name wins. Otherwise a shop prints its shop name,
 * and everyone else prints the public display name. Legal first/last name
 * is never used here.
 */
export function formatSellerProfileForShipEngineShipFrom(profile: {
  display_name: string | null
  shop_name: string | null
  is_shop: boolean | null
  shipping_label_name?: string | null
} | null): string {
  if (!profile) return "Seller"
  const chosen = profile.shipping_label_name?.trim()
  if (chosen) return truncateShipFromName(chosen)
  if (profile.is_shop === true) {
    const shop = profile.shop_name?.trim()
    if (shop) return truncateShipFromName(shop)
  }
  const display = profile.display_name?.trim()
  if (display) return truncateShipFromName(display)
  return "Seller"
}

export async function fetchSellerShipFromLabelName(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, shop_name, is_shop, shipping_label_name")
    .eq("id", sellerUserId)
    .maybeSingle()

  if (error) {
    console.warn("[fetchSellerShipFromLabelName]", error.message)
    return "Seller"
  }
  return formatSellerProfileForShipEngineShipFrom(
    data as {
      display_name: string | null
      shop_name: string | null
      is_shop: boolean | null
      shipping_label_name: string | null
    } | null,
  )
}
