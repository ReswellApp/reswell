import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import { latestSellerCounterNoteFromTimeline } from "@/lib/utils/offer-timeline"

function mapProfiles(
  profiles: DashboardProfileLite[] | null,
): Record<string, DashboardProfileLite> {
  const map: Record<string, DashboardProfileLite> = {}
  for (const p of profiles ?? []) {
    map[p.id] = p
  }
  return map
}

type OfferDashboardRowRaw = Omit<DashboardOfferRow, "seller_counter_note"> & {
  offer_timeline?: unknown
}

function withSellerCounterNotes(rows: OfferDashboardRowRaw[]): DashboardOfferRow[] {
  return rows.map(({ offer_timeline, ...rest }) => ({
    ...rest,
    seller_counter_note:
      rest.status === "COUNTERED" ? latestSellerCounterNoteFromTimeline(offer_timeline) : null,
  }))
}

/**
 * Offers the user submitted as buyer (all statuses), with listing + counterparty seller profile.
 */
export async function fetchOffersMadeForDashboard(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<{
  offers: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  /** Set when the offers query fails (e.g. missing table, wrong env). Shown in dev UI. */
  fetchError?: string
}> {
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
      seller_initiated,
      offer_timeline,
      listings (
        id,
        title,
        slug,
        section,
        price,
        status,
        listing_images (url, is_primary, thumbnail_url)
      )
    `,
    )
    .eq("buyer_id", buyerId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[fetchOffersMadeForDashboard]", error)
    return {
      offers: [],
      sellersById: {},
      fetchError: error.message,
    }
  }

  const offers = withSellerCounterNotes((data ?? []) as OfferDashboardRowRaw[])

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
): Promise<{
  offers: DashboardOfferRow[]
  buyersById: Record<string, DashboardProfileLite>
  fetchError?: string
}> {
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
      seller_initiated,
      offer_timeline,
      listings (
        id,
        title,
        slug,
        section,
        price,
        status,
        listing_images (url, is_primary, thumbnail_url)
      )
    `,
    )
    .eq("seller_id", sellerId)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[fetchOffersReceivedForDashboard]", error)
    return {
      offers: [],
      buyersById: {},
      fetchError: error.message,
    }
  }

  const offers = withSellerCounterNotes((data ?? []) as OfferDashboardRowRaw[])
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
