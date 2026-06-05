import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  DashboardOfferRow,
  DashboardProfileLite,
} from "@/lib/types/offers-dashboard"
import { latestSellerCounterNoteFromTimeline, openingOfferNoteFromTimeline } from "@/lib/utils/offer-timeline"
import {
  partitionOffersByDirection,
  shouldShowOfferInDashboard,
} from "@/lib/utils/offers-dashboard-display"

function mapProfiles(
  profiles: DashboardProfileLite[] | null,
): Record<string, DashboardProfileLite> {
  const map: Record<string, DashboardProfileLite> = {}
  for (const p of profiles ?? []) {
    map[p.id] = p
  }
  return map
}

type OfferDashboardRowRaw = Omit<DashboardOfferRow, "seller_counter_note" | "buyer_note"> & {
  offer_timeline?: unknown
}

const OFFER_SELECT = `
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
  fulfillment,
  shipping_amount,
  listings (
    id,
    title,
    slug,
    section,
    price,
    status,
    listing_images (url, is_primary, thumbnail_url)
  )
`

function withSellerCounterNotes(rows: OfferDashboardRowRaw[]): DashboardOfferRow[] {
  return rows.map(({ offer_timeline, ...rest }) => ({
    ...rest,
    seller_counter_note:
      rest.status === "COUNTERED" ? latestSellerCounterNoteFromTimeline(offer_timeline) : null,
    buyer_note: openingOfferNoteFromTimeline(offer_timeline, { sellerInitiated: false }),
  }))
}

export type DashboardOffersPartitioned = {
  sent: DashboardOfferRow[]
  received: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  buyersById: Record<string, DashboardProfileLite>
  fetchError?: string
}

/** All offers the user participates in, split by who started the negotiation. */
export async function fetchDashboardOffersPartitioned(
  supabase: SupabaseClient,
  userId: string,
): Promise<DashboardOffersPartitioned> {
  const [{ data: asBuyer, error: buyerErr }, { data: asSeller, error: sellerErr }] =
    await Promise.all([
      supabase
        .from("offers")
        .select(OFFER_SELECT)
        .eq("buyer_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("offers")
        .select(OFFER_SELECT)
        .eq("seller_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200),
    ])

  const fetchError = buyerErr?.message ?? sellerErr?.message
  if (fetchError) {
    console.error("[fetchDashboardOffersPartitioned]", buyerErr ?? sellerErr)
    return { sent: [], received: [], sellersById: {}, buyersById: {}, fetchError }
  }

  const byId = new Map<string, OfferDashboardRowRaw>()
  for (const row of [...(asBuyer ?? []), ...(asSeller ?? [])]) {
    byId.set(row.id as string, row as OfferDashboardRowRaw)
  }

  const visible = withSellerCounterNotes([...byId.values()]).filter(shouldShowOfferInDashboard)
  const { sent, received } = partitionOffersByDirection(visible, userId)

  const sellerIds = [...new Set(visible.map((o) => o.seller_id))]
  const buyerIds = [...new Set(visible.map((o) => o.buyer_id))]

  const [{ data: sellerProfiles }, { data: buyerProfiles }] = await Promise.all([
    sellerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name, avatar_url, shop_name, is_shop")
          .in("id", sellerIds)
      : Promise.resolve({ data: [] as DashboardProfileLite[] }),
    buyerIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, display_name, avatar_url, shop_name, is_shop")
          .in("id", buyerIds)
      : Promise.resolve({ data: [] as DashboardProfileLite[] }),
  ])

  return {
    sent,
    received,
    sellersById: mapProfiles((sellerProfiles ?? []) as DashboardProfileLite[]),
    buyersById: mapProfiles((buyerProfiles ?? []) as DashboardProfileLite[]),
  }
}

/** Offers the user sent (buyer-initiated or seller-initiated to a buyer). */
export async function fetchOffersMadeForDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  offers: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  buyersById: Record<string, DashboardProfileLite>
  fetchError?: string
}> {
  const r = await fetchDashboardOffersPartitioned(supabase, userId)
  return {
    offers: r.sent,
    sellersById: r.sellersById,
    buyersById: r.buyersById,
    fetchError: r.fetchError,
  }
}

/** Offers the user received (from buyers on their listings or from sellers). */
export async function fetchOffersReceivedForDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  offers: DashboardOfferRow[]
  sellersById: Record<string, DashboardProfileLite>
  buyersById: Record<string, DashboardProfileLite>
  fetchError?: string
}> {
  const r = await fetchDashboardOffersPartitioned(supabase, userId)
  return {
    offers: r.received,
    sellersById: r.sellersById,
    buyersById: r.buyersById,
    fetchError: r.fetchError,
  }
}
