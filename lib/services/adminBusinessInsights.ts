import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Marketplace-wide business intelligence for the admin overview.
 *
 * Runs on the **service-role** client because there is no staff RLS policy on
 * `orders` — the user-session client would only return the admin's own orders.
 * Mirrors the aggregation approach in `usedBoardMarketDashboard.ts` and the
 * `is_admin_test = false` filtering used by `adminPlatformFees.ts`.
 *
 * Money is treated as USD (no `currency` column on `orders`/`listings`).
 * "GMV" is gross merchandise value = sum of `orders.amount` (item + shipping)
 * for confirmed, non-test orders. "Sale time" is `orders.created_at` (there is
 * no `listings.sold_at`).
 */

/** Rolling comparison window for the BI dashboard. */
export const ADMIN_INSIGHTS_PERIOD_DAYS = 30

const ORDERS_FETCH_CAP = 20000
const LISTING_LOOKUP_CHUNK = 200
const TOP_SELLERS_LIMIT = 6
const TOP_BRANDS_LIMIT = 6

export type TrendMetric = {
  current: number
  previous: number
  /** Percentage change vs the prior period. `null` when the prior period was 0. */
  deltaPct: number | null
}

export type AdminInsightsDailyPoint = {
  date: string
  gmv: number
  fees: number
  orders: number
}

export type AdminInsightsTopSeller = {
  id: string
  name: string
  gmv: number
  orders: number
}

export type AdminInsightsBrandRow = {
  brand: string
  gmv: number
  orders: number
}

export type AdminInsightsSectionRow = {
  section: string
  gmv: number
  orders: number
  share: number
}

export type AdminInsightsOrderPreview = {
  id: string
  order_num: string | null
  status: string
  amount: number
  created_at: string
}

export type AdminBusinessInsights = {
  periodDays: number
  revenue: {
    gmv: TrendMetric
    platformRevenue: TrendMetric
    orders: TrendMetric
    aov: TrendMetric
  }
  /** Platform fee ÷ item GMV (GMV minus shipping), as a percentage. */
  takeRatePct: number | null
  /** Refunded ÷ (confirmed + refunded) within the current window, as a percentage. */
  refundRatePct: number
  refundCount: number
  daily: AdminInsightsDailyPoint[]
  growth: {
    newMembers: TrendMetric
    newListings: TrendMetric
  }
  supply: {
    activeListings: number
    activeSurfboards: number
    soldInPeriod: number
    /** sold(period) ÷ (sold(period) + active surfboards), as a percentage. */
    sellThroughPct: number | null
  }
  topSellers: AdminInsightsTopSeller[]
  topBrands: AdminInsightsBrandRow[]
  sectionMix: AdminInsightsSectionRow[]
  offers: {
    created: TrendMetric
    accepted: number
    /** accepted ÷ resolved offers (accepted + declined + expired), as a percentage. */
    acceptanceRatePct: number | null
  }
  recentOrders: AdminInsightsOrderPreview[]
}

type OrderRow = {
  id: string
  order_num: string | null
  amount: number
  platform_fee: number
  shipping_amount: number
  status: string
  created_at: string
  seller_id: string | null
  listing_id: string | null
}

function num(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function trend(current: number, previous: number): TrendMetric {
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null
  return { current, previous, deltaPct }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function buildDayKeys(fromMs: number, toMs: number): string[] {
  const start = new Date(fromMs)
  const end = new Date(toMs)
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  const keys: string[] = []
  for (let d = startUtc; d <= endUtc; d += 24 * 60 * 60 * 1000) {
    keys.push(new Date(d).toISOString().slice(0, 10))
  }
  return keys
}

async function fetchListingMeta(
  db: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, { section: string; brand: string | null }>> {
  const meta = new Map<string, { section: string; brand: string | null }>()
  for (let i = 0; i < listingIds.length; i += LISTING_LOOKUP_CHUNK) {
    const chunk = listingIds.slice(i, i + LISTING_LOOKUP_CHUNK)
    const { data, error } = await db
      .from('listings')
      .select('id, section, brand')
      .in('id', chunk)
    if (error || !data) continue
    for (const row of data) {
      const r = row as Record<string, unknown>
      meta.set(String(r.id), {
        section: String(r.section ?? 'unknown'),
        brand: r.brand == null || r.brand === '' ? null : String(r.brand),
      })
    }
  }
  return meta
}

async function fetchSellerNames(
  db: SupabaseClient,
  sellerIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (sellerIds.length === 0) return names
  const { data } = await db
    .from('profiles')
    .select('id, display_name')
    .in('id', sellerIds)
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const name = r.display_name == null ? '' : String(r.display_name).trim()
    names.set(String(r.id), name)
  }
  return names
}

export async function loadAdminBusinessInsights(): Promise<
  { ok: true; data: AdminBusinessInsights } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const periodMs = ADMIN_INSIGHTS_PERIOD_DAYS * dayMs
    const since30 = new Date(now - periodMs).toISOString()
    const since60 = new Date(now - 2 * periodMs).toISOString()

    const [
      ordersRes,
      offersRes,
      activeListingsRes,
      activeSurfboardsRes,
      newMembersCurRes,
      newMembersPrevRes,
      newListingsCurRes,
      newListingsPrevRes,
    ] = await Promise.all([
      db
        .from('orders')
        .select(
          'id, order_num, amount, platform_fee, shipping_amount, status, created_at, seller_id, listing_id',
        )
        .eq('is_admin_test', false)
        .gte('created_at', since60)
        .order('created_at', { ascending: false })
        .limit(ORDERS_FETCH_CAP),
      db.from('offers').select('status, created_at').gte('created_at', since60),
      db.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('section', 'surfboards')
        .eq('hidden_from_site', false),
      db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since30),
      db
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since60)
        .lt('created_at', since30),
      db.from('listings').select('*', { count: 'exact', head: true }).gte('created_at', since30),
      db
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since60)
        .lt('created_at', since30),
    ])

    if (ordersRes.error) {
      return { ok: false, error: 'Could not load marketplace orders for insights.' }
    }

    const orders: OrderRow[] = (ordersRes.data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id ?? ''),
        order_num: r.order_num == null ? null : String(r.order_num),
        amount: num(r.amount),
        platform_fee: num(r.platform_fee),
        shipping_amount: num(r.shipping_amount),
        status: String(r.status ?? ''),
        created_at: String(r.created_at ?? ''),
        seller_id: r.seller_id == null ? null : String(r.seller_id),
        listing_id: r.listing_id == null ? null : String(r.listing_id),
      }
    })

    // Partition by window + status.
    let gmvCur = 0
    let gmvPrev = 0
    let itemGmvCur = 0
    let feesCur = 0
    let feesPrev = 0
    let ordersCur = 0
    let ordersPrev = 0
    let refundedCur = 0

    const dailyMap = new Map<string, { gmv: number; fees: number; orders: number }>()
    for (const key of buildDayKeys(now - periodMs, now)) {
      dailyMap.set(key, { gmv: 0, fees: 0, orders: 0 })
    }

    const sellerAgg = new Map<string, { gmv: number; orders: number }>()
    const listingAgg = new Map<string, { gmv: number; orders: number }>()

    for (const o of orders) {
      const ts = new Date(o.created_at).getTime()
      const inCurrent = ts >= now - periodMs
      const confirmed = o.status === 'confirmed'
      const refunded = o.status === 'refunded' || o.status === 'refunding'

      if (confirmed) {
        if (inCurrent) {
          gmvCur += o.amount
          itemGmvCur += Math.max(0, o.amount - o.shipping_amount)
          feesCur += o.platform_fee
          ordersCur += 1

          const bucket = dailyMap.get(dayKey(o.created_at))
          if (bucket) {
            bucket.gmv += o.amount
            bucket.fees += o.platform_fee
            bucket.orders += 1
          }
          if (o.seller_id) {
            const s = sellerAgg.get(o.seller_id) ?? { gmv: 0, orders: 0 }
            s.gmv += o.amount
            s.orders += 1
            sellerAgg.set(o.seller_id, s)
          }
          if (o.listing_id) {
            const l = listingAgg.get(o.listing_id) ?? { gmv: 0, orders: 0 }
            l.gmv += o.amount
            l.orders += 1
            listingAgg.set(o.listing_id, l)
          }
        } else {
          gmvPrev += o.amount
          feesPrev += o.platform_fee
          ordersPrev += 1
        }
      } else if (refunded && inCurrent) {
        refundedCur += 1
      }
    }

    const daily: AdminInsightsDailyPoint[] = Array.from(dailyMap.entries()).map(
      ([date, v]) => ({ date, gmv: v.gmv, fees: v.fees, orders: v.orders }),
    )

    const aovCur = ordersCur > 0 ? gmvCur / ordersCur : 0
    const aovPrev = ordersPrev > 0 ? gmvPrev / ordersPrev : 0
    const takeRatePct = itemGmvCur > 0 ? (feesCur / itemGmvCur) * 100 : null
    const refundDenom = ordersCur + refundedCur
    const refundRatePct = refundDenom > 0 ? (refundedCur / refundDenom) * 100 : 0

    // Top sellers (resolve names).
    const topSellerIds = Array.from(sellerAgg.entries())
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, TOP_SELLERS_LIMIT)
      .map(([id]) => id)
    const sellerNames = await fetchSellerNames(db, topSellerIds)
    const topSellers: AdminInsightsTopSeller[] = topSellerIds.map((id) => {
      const agg = sellerAgg.get(id)!
      const name = sellerNames.get(id)
      return {
        id,
        name: name && name.length > 0 ? name : `${id.slice(0, 8)}…`,
        gmv: agg.gmv,
        orders: agg.orders,
      }
    })

    // Brand + section mix (resolve listing metadata).
    const listingMeta = await fetchListingMeta(db, Array.from(listingAgg.keys()))
    const brandAgg = new Map<string, { gmv: number; orders: number }>()
    const sectionAgg = new Map<string, { gmv: number; orders: number }>()
    for (const [listingId, agg] of listingAgg.entries()) {
      const meta = listingMeta.get(listingId)
      const brand = meta?.brand ?? 'Unbranded'
      const section = meta?.section ?? 'unknown'
      const b = brandAgg.get(brand) ?? { gmv: 0, orders: 0 }
      b.gmv += agg.gmv
      b.orders += agg.orders
      brandAgg.set(brand, b)
      const s = sectionAgg.get(section) ?? { gmv: 0, orders: 0 }
      s.gmv += agg.gmv
      s.orders += agg.orders
      sectionAgg.set(section, s)
    }
    const topBrands: AdminInsightsBrandRow[] = Array.from(brandAgg.entries())
      .map(([brand, v]) => ({ brand, gmv: v.gmv, orders: v.orders }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, TOP_BRANDS_LIMIT)
    const sectionTotalGmv = Array.from(sectionAgg.values()).reduce((s, v) => s + v.gmv, 0)
    const sectionMix: AdminInsightsSectionRow[] = Array.from(sectionAgg.entries())
      .map(([section, v]) => ({
        section,
        gmv: v.gmv,
        orders: v.orders,
        share: sectionTotalGmv > 0 ? (v.gmv / sectionTotalGmv) * 100 : 0,
      }))
      .sort((a, b) => b.gmv - a.gmv)

    // Recent orders (accurate, service-role).
    const recentOrders: AdminInsightsOrderPreview[] = orders.slice(0, 8).map((o) => ({
      id: o.id,
      order_num: o.order_num,
      status: o.status,
      amount: o.amount,
      created_at: o.created_at,
    }))

    // Offers funnel.
    let offersCreatedCur = 0
    let offersCreatedPrev = 0
    let offersAcceptedCur = 0
    let offersDeclinedCur = 0
    let offersExpiredCur = 0
    for (const row of offersRes.data ?? []) {
      const r = row as Record<string, unknown>
      const status = String(r.status ?? '').toUpperCase()
      const ts = new Date(String(r.created_at ?? '')).getTime()
      const inCurrent = ts >= now - periodMs
      if (inCurrent) {
        offersCreatedCur += 1
        if (status === 'ACCEPTED' || status === 'COMPLETED') offersAcceptedCur += 1
        else if (status === 'DECLINED') offersDeclinedCur += 1
        else if (status === 'EXPIRED') offersExpiredCur += 1
      } else {
        offersCreatedPrev += 1
      }
    }
    const offersResolved = offersAcceptedCur + offersDeclinedCur + offersExpiredCur
    const acceptanceRatePct =
      offersResolved > 0 ? (offersAcceptedCur / offersResolved) * 100 : null

    const soldInPeriod = ordersCur
    const activeSurfboards = activeSurfboardsRes.count ?? 0
    const sellThroughDenom = soldInPeriod + activeSurfboards
    const sellThroughPct =
      sellThroughDenom > 0 ? (soldInPeriod / sellThroughDenom) * 100 : null

    return {
      ok: true,
      data: {
        periodDays: ADMIN_INSIGHTS_PERIOD_DAYS,
        revenue: {
          gmv: trend(gmvCur, gmvPrev),
          platformRevenue: trend(feesCur, feesPrev),
          orders: trend(ordersCur, ordersPrev),
          aov: trend(aovCur, aovPrev),
        },
        takeRatePct,
        refundRatePct,
        refundCount: refundedCur,
        daily,
        growth: {
          newMembers: trend(newMembersCurRes.count ?? 0, newMembersPrevRes.count ?? 0),
          newListings: trend(newListingsCurRes.count ?? 0, newListingsPrevRes.count ?? 0),
        },
        supply: {
          activeListings: activeListingsRes.count ?? 0,
          activeSurfboards,
          soldInPeriod,
          sellThroughPct,
        },
        topSellers,
        topBrands,
        sectionMix,
        offers: {
          created: trend(offersCreatedCur, offersCreatedPrev),
          accepted: offersAcceptedCur,
          acceptanceRatePct,
        },
        recentOrders,
      },
    }
  } catch {
    return {
      ok: false,
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to compute marketplace business insights.',
    }
  }
}
