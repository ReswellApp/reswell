import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"

function mapProfiles(
  profiles: DashboardProfileLite[] | null,
): Record<string, DashboardProfileLite> {
  const map: Record<string, DashboardProfileLite> = {}
  for (const p of profiles ?? []) {
    map[p.id] = p
  }
  return map
}

/**
 * Offers the user submitted as buyer (all statuses), with listing + counterparty seller profile.
 */
export async function fetchOffersMadeForDashboard(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<{ offers: DashboardOfferRow[]; sellersById: Record<string, DashboardProfileLite> }> {
  const { data, error } = await supabase
    .from("offers")
    .select(
      `
      id,
      status,
      current_amount,
      initial_amount,
      expires_at,
      created_at,
      updated_at,
      counter_count,
      listing_id,
      buyer_id,
      seller_id,
      listings (
        id,
        title,
        slug,
        section,
        price,
        status,
        listing_images (url, is_primary)
      )
    `,
    )
    .eq("buyer_id", buyerId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[fetchOffersMadeForDashboard]", error)
    return { offers: [], sellersById: {} }
  }

  const offers = (data ?? []) as DashboardOfferRow[]
  const sellerIds = [...new Set(offers.map((o) => o.seller_id))]
  if (sellerIds.length === 0) {
    return { offers, sellersById: {} }
  }

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, shop_name, is_shop")
    .in("id", sellerIds)

  return {
    offers,
    sellersById: mapProfiles((profs ?? []) as DashboardProfileLite[]),
  }
}

/**
 * Offers on the user's listings (seller role), with listing + buyer profile.
 */
export async function fetchOffersReceivedForDashboard(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<{ offers: DashboardOfferRow[]; buyersById: Record<string, DashboardProfileLite> }> {
  const { data, error } = await supabase
    .from("offers")
    .select(
      `
      id,
      status,
      current_amount,
      initial_amount,
      expires_at,
      created_at,
      updated_at,
      counter_count,
      listing_id,
      buyer_id,
      seller_id,
      listings (
        id,
        title,
        slug,
        section,
        price,
        status,
        listing_images (url, is_primary)
      )
    `,
    )
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[fetchOffersReceivedForDashboard]", error)
    return { offers: [], buyersById: {} }
  }

  const offers = (data ?? []) as DashboardOfferRow[]
  const buyerIds = [...new Set(offers.map((o) => o.buyer_id))]
  if (buyerIds.length === 0) {
    return { offers, buyersById: {} }
  }

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, shop_name, is_shop")
    .in("id", buyerIds)

  return {
    offers,
    buyersById: mapProfiles((profs ?? []) as DashboardProfileLite[]),
  }
}
