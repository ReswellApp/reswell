import type { SupabaseClient } from '@supabase/supabase-js'

import { isHiddenFromAdminOverviewReport } from '@/lib/admin/overview-report-orders'
import { listTippedMarkSoldGmsContributions } from '@/lib/db/sellerSaleTips'
import { isElasticsearchConfigured } from '@/lib/elasticsearch/config'
import { countMarketplaceSearchesInRange } from '@/lib/elasticsearch/search-analytics-index'
import type {
  AdminOverviewListingPreview,
  AdminOverviewSupportPreview,
  AdminOverviewUserPreview,
} from '@/lib/db/adminOverview'
import type { ContactMessageSupportStatus } from '@/lib/db/contactMessages'
import { createServiceRoleClient } from '@/lib/supabase/server'
import type {
  AdminBusinessInsights,
  AdminInsightsBrandRow,
  AdminInsightsDailyPoint,
  AdminInsightsOrderPreview,
  AdminInsightsSectionRow,
  AdminInsightsTopSeller,
  AdminMomentumMatrix,
  AdminMonthlyRevenueRow,
  AdminRevenueTrend,
  LoadAdminBusinessInsightsOptions,
  LoadAdminRevenueTrendOptions,
  MomentumComparison,
  MomentumFormat,
  MomentumMetric,
  MomentumMetricKey,
  TrendMetric,
} from '@/lib/types/adminBusinessInsights'
import {
  resolveAdminHomeRevenuePeriod,
  resolveAdminInsightsPeriod,
  businessMonthStartIso,
  businessYearMonthChoices,
} from '@/lib/utils/adminInsightsPeriod'
import {
  buildAdminRevenueMonthlyPoints,
  buildAdminRevenuePaceInsight,
} from '@/lib/utils/adminRevenueMonthly'
import {
  marketplaceGmvExcludingShippingUsd,
  marketplaceListingItemGmvUsd,
  marketplacePromoMarketingUsd,
} from '@/lib/seller-fees'
import { buildBusinessDayKeysForPeriod, businessDayKey } from '@/lib/utils/business-timezone'

export { ADMIN_INSIGHTS_PERIOD_DAYS } from '@/lib/utils/adminInsightsPeriod'
export type {
  AdminBusinessInsights,
  AdminInsightsBrandRow,
  AdminInsightsDailyPoint,
  AdminInsightsOrderPreview,
  AdminInsightsSectionRow,
  AdminInsightsTopSeller,
  AdminMomentumMatrix,
  AdminMonthlyRevenueRow,
  AdminRevenueTrend,
  LoadAdminBusinessInsightsOptions,
  LoadAdminRevenueTrendOptions,
  MomentumComparison,
  MomentumFormat,
  MomentumMetric,
  MomentumMetricKey,
  TrendMetric,
} from '@/lib/types/adminBusinessInsights'

/**
 * Marketplace-wide business intelligence for the admin overview.
 *
 * Runs on the **service-role** client because there is no staff RLS policy on
 * `orders` — the user-session client would only return the admin's own orders.
 * Mirrors the aggregation approach in `usedBoardMarketDashboard.ts` and the
 * `is_admin_test = false` filtering used by `adminPlatformFees.ts`.
 *
 * Money is treated as USD (no `currency` column on `orders`/`listings`).
 * GMV is buyer-paid merchandise = `orders.amount` minus `orders.shipping_amount`
 * (net of Reswell promo), plus listing prices of off-platform mark-as-sold
 * sales with a succeeded seller tip. Shipping collected from buyers is not GMV.
 * Take rate uses listing item GMV from confirmed checkout only (seller earnings +
 * platform fee) — the 7% fee base — so promo codes and off-platform tips do
 * not dilute the rate.
 * Promo discounts are reported as marketing expense. "Sale time" is
 * `orders.created_at` for checkouts and `seller_sale_tips.succeeded_at` for
 * tipped mark-as-sold GMS. Daily chart buckets use Pacific Time.
 */

const ORDERS_FETCH_CAP = 20000
const LISTING_LOOKUP_CHUNK = 200
const TOP_SELLERS_LIMIT = 6
const TOP_BRANDS_LIMIT = 6

type OrderRow = {
  id: string
  order_num: string | null
  amount: number
  platform_fee: number
  shipping_amount: number
  seller_earnings: number | null
  promo_discount_usd: number
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

function listingSellerName(
  profiles: { display_name: string | null } | { display_name: string | null }[] | null,
): string | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0]?.display_name ?? null
  return profiles.display_name ?? null
}

function mapRecentListings(data: unknown[] | null): AdminOverviewListingPreview[] {
  const rows: AdminOverviewListingPreview[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const profilesRaw = r.profiles as
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null
    rows.push({
      id: String(r.id ?? ''),
      title: String(r.title ?? ''),
      slug: r.slug == null ? null : String(r.slug),
      price: Number(r.price ?? 0),
      section: String(r.section ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.created_at ?? ''),
      seller_display_name: listingSellerName(profilesRaw),
    })
  }
  return rows
}

function mapRecentUsers(data: unknown[] | null): AdminOverviewUserPreview[] {
  const rows: AdminOverviewUserPreview[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    rows.push({
      id: String(r.id ?? ''),
      display_name: r.display_name == null ? null : String(r.display_name),
      email: r.email == null ? null : String(r.email),
      created_at: String(r.created_at ?? ''),
    })
  }
  return rows
}

function mapRecentSupport(data: unknown[] | null): AdminOverviewSupportPreview[] {
  const rows: AdminOverviewSupportPreview[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    rows.push({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      email: String(r.email ?? ''),
      subject: r.subject == null || r.subject === '' ? null : String(r.subject),
      support_status: (r.support_status as ContactMessageSupportStatus) ?? 'new',
      source: String(r.source ?? 'contact_form'),
      created_at: String(r.created_at ?? ''),
    })
  }
  return rows
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

export async function loadAdminBusinessInsights(
  options?: LoadAdminBusinessInsightsOptions,
): Promise<
  { ok: true; data: AdminBusinessInsights } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()

    const now = Date.now()
    const period = resolveAdminInsightsPeriod(options?.yearMonth)
    const {
      periodStartMs,
      periodEndMs,
      prevStartMs,
      prevEndMs,
      fetchSinceIso: sinceFetch,
    } = period

    const growthSinceIso = new Date(periodStartMs).toISOString()
    const periodEndIso = new Date(periodEndMs).toISOString()
    const growthPrevSinceIso = new Date(prevStartMs).toISOString()
    const growthPrevUntilIso = new Date(prevEndMs).toISOString()

    const [
      ordersRes,
      tippedGms,
      offersRes,
      activeListingsRes,
      activeSurfboardsRes,
      newMembersCurRes,
      newMembersPrevRes,
      newListingsCurRes,
      newListingsPrevRes,
      newSupportCurRes,
      newSupportPrevRes,
      recentListingsRes,
      recentUsersRes,
      recentSupportRes,
    ] = await Promise.all([
      db
        .from('orders')
        .select(
          'id, order_num, amount, platform_fee, shipping_amount, seller_earnings, promo_discount_usd, status, created_at, seller_id, listing_id',
        )
        .eq('is_admin_test', false)
        .gte('created_at', sinceFetch)
        .order('created_at', { ascending: false })
        .limit(ORDERS_FETCH_CAP),
      listTippedMarkSoldGmsContributions(db),
      db.from('offers').select('status, created_at').gte('created_at', sinceFetch),
      db.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('section', 'surfboards')
        .eq('hidden_from_site', false),
      db
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthSinceIso)
        .lt('created_at', new Date(periodEndMs).toISOString()),
      db
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthPrevSinceIso)
        .lt('created_at', growthPrevUntilIso),
      db
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthSinceIso)
        .lt('created_at', new Date(periodEndMs).toISOString()),
      db
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthPrevSinceIso)
        .lt('created_at', growthPrevUntilIso),
      db
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthSinceIso)
        .lt('created_at', periodEndIso),
      db
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', growthPrevSinceIso)
        .lt('created_at', growthPrevUntilIso),
      db
        .from('listings')
        .select(
          'id, title, slug, price, section, status, created_at, profiles!listings_user_id_fkey(display_name)',
        )
        .gte('created_at', growthSinceIso)
        .lt('created_at', periodEndIso)
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('profiles')
        .select('id, display_name, email, created_at')
        .gte('created_at', growthSinceIso)
        .lt('created_at', periodEndIso)
        .order('created_at', { ascending: false })
        .limit(8),
      db
        .from('contact_messages')
        .select('id, name, email, subject, support_status, source, created_at')
        .gte('created_at', growthSinceIso)
        .lt('created_at', periodEndIso)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    if (ordersRes.error) {
      return { ok: false, error: 'Could not load marketplace orders for insights.' }
    }

    const orders: OrderRow[] = (ordersRes.data ?? [])
      .map((row) => {
        const r = row as Record<string, unknown>
        return {
          id: String(r.id ?? ''),
          order_num: r.order_num == null ? null : String(r.order_num),
          amount: num(r.amount),
          platform_fee: num(r.platform_fee),
          shipping_amount: num(r.shipping_amount),
          seller_earnings: r.seller_earnings == null ? null : num(r.seller_earnings),
          promo_discount_usd: num(r.promo_discount_usd),
          status: String(r.status ?? ''),
          created_at: String(r.created_at ?? ''),
          seller_id: r.seller_id == null ? null : String(r.seller_id),
          listing_id: r.listing_id == null ? null : String(r.listing_id),
        }
      })
      .filter((o) => !isHiddenFromAdminOverviewReport(o))

    // Partition by window + status.
    let gmvCur = 0
    let gmvPrev = 0
    let listingItemGmvCur = 0
    let feesCur = 0
    let feesPrev = 0
    let promoCur = 0
    let promoPrev = 0
    let ordersCur = 0
    let ordersPrev = 0
    let refundedCur = 0

    const dailyMap = new Map<string, { gmv: number; fees: number; orders: number }>()
    for (const key of buildBusinessDayKeysForPeriod(periodStartMs, periodEndMs)) {
      dailyMap.set(key, { gmv: 0, fees: 0, orders: 0 })
    }

    const sellerAgg = new Map<string, { gmv: number; orders: number }>()
    const listingAgg = new Map<string, { gmv: number; orders: number }>()

    for (const o of orders) {
      const ts = new Date(o.created_at).getTime()
      const inCurrent = ts >= periodStartMs && ts < periodEndMs
      const inPrevious = ts >= prevStartMs && ts < prevEndMs
      const confirmed = o.status === 'confirmed'
      const refunded = o.status === 'refunded' || o.status === 'refunding'

      if (confirmed) {
        if (inCurrent) {
          const gmv = marketplaceGmvExcludingShippingUsd(o)
          gmvCur += gmv
          listingItemGmvCur += marketplaceListingItemGmvUsd(o)
          feesCur += o.platform_fee
          promoCur += marketplacePromoMarketingUsd(o)
          ordersCur += 1

          const bucket = dailyMap.get(businessDayKey(o.created_at))
          if (bucket) {
            bucket.gmv += gmv
            bucket.fees += o.platform_fee
            bucket.orders += 1
          }
          if (o.seller_id) {
            const s = sellerAgg.get(o.seller_id) ?? { gmv: 0, orders: 0 }
            s.gmv += gmv
            s.orders += 1
            sellerAgg.set(o.seller_id, s)
          }
          if (o.listing_id) {
            const l = listingAgg.get(o.listing_id) ?? { gmv: 0, orders: 0 }
            l.gmv += gmv
            l.orders += 1
            listingAgg.set(o.listing_id, l)
          }
        } else if (inPrevious) {
          gmvPrev += marketplaceGmvExcludingShippingUsd(o)
          feesPrev += o.platform_fee
          promoPrev += marketplacePromoMarketingUsd(o)
          ordersPrev += 1
        }
      } else if (refunded && inCurrent) {
        refundedCur += 1
      }
    }

    const aovCur = ordersCur > 0 ? gmvCur / ordersCur : 0
    const aovPrev = ordersPrev > 0 ? gmvPrev / ordersPrev : 0

    for (const tip of tippedGms) {
      const ts = new Date(tip.succeededAt).getTime()
      const inCurrent = ts >= periodStartMs && ts < periodEndMs
      const inPrevious = ts >= prevStartMs && ts < prevEndMs
      if (inCurrent) {
        gmvCur += tip.listingPriceUsd
        const bucket = dailyMap.get(businessDayKey(tip.succeededAt))
        if (bucket) {
          bucket.gmv += tip.listingPriceUsd
        }
        const s = sellerAgg.get(tip.sellerUserId) ?? { gmv: 0, orders: 0 }
        s.gmv += tip.listingPriceUsd
        s.orders += 1
        sellerAgg.set(tip.sellerUserId, s)
        const l = listingAgg.get(tip.listingId) ?? { gmv: 0, orders: 0 }
        l.gmv += tip.listingPriceUsd
        l.orders += 1
        listingAgg.set(tip.listingId, l)
      } else if (inPrevious) {
        gmvPrev += tip.listingPriceUsd
      }
    }

    const daily: AdminInsightsDailyPoint[] = Array.from(dailyMap.entries()).map(
      ([date, v]) => ({
        date,
        gmv: v.gmv,
        fees: v.fees,
        orders: v.orders,
      }),
    )

    const takeRatePct = listingItemGmvCur > 0 ? (feesCur / listingItemGmvCur) * 100 : null
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

    // Recent orders in the current period only (service-role).
    const recentOrders: AdminInsightsOrderPreview[] = orders
      .filter((o) => {
        const ts = new Date(o.created_at).getTime()
        return ts >= periodStartMs && ts < periodEndMs
      })
      .slice(0, 8)
      .map((o) => ({
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
      const inCurrent = ts >= periodStartMs && ts < periodEndMs
      const inPrevious = ts >= prevStartMs && ts < prevEndMs
      if (inCurrent) {
        offersCreatedCur += 1
        if (status === 'ACCEPTED' || status === 'COMPLETED') offersAcceptedCur += 1
        else if (status === 'DECLINED') offersDeclinedCur += 1
        else if (status === 'EXPIRED') offersExpiredCur += 1
      } else if (inPrevious) {
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
        periodMode: period.mode,
        periodLabel: period.label,
        comparePeriodLabel: period.compareLabel,
        selectedYearMonth: period.mode === 'month' ? period.yearMonth : null,
        periodDays: period.periodDays,
        revenue: {
          gmv: trend(gmvCur, gmvPrev),
          platformRevenue: trend(feesCur, feesPrev),
          marketingExpense: trend(promoCur, promoPrev),
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
          newSupportThreads: trend(
            newSupportCurRes.count ?? 0,
            newSupportPrevRes.count ?? 0,
          ),
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
        recentListings: mapRecentListings(recentListingsRes.data),
        recentUsers: mapRecentUsers(recentUsersRes.data),
        recentSupport: mapRecentSupport(recentSupportRes.data),
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

export async function loadAdminRevenueTrend(
  options?: LoadAdminRevenueTrendOptions,
): Promise<{ ok: true; data: AdminRevenueTrend } | { ok: false; error: string }> {
  try {
    const db = createServiceRoleClient()
    const range = options?.range ?? 'ytd'
    const period = resolveAdminHomeRevenuePeriod(options?.yearMonth, range)
    const periodStartIso = new Date(period.periodStartMs).toISOString()
    const periodEndIso = new Date(period.periodEndMs).toISOString()

    const [{ data: orderRows, error }, tippedGms] = await Promise.all([
      db
        .from('orders')
        .select('id, amount, shipping_amount, platform_fee, status, created_at')
        .eq('is_admin_test', false)
        .gte('created_at', periodStartIso)
        .lt('created_at', periodEndIso)
        .order('created_at', { ascending: false })
        .limit(ORDERS_FETCH_CAP),
      listTippedMarkSoldGmsContributions(db),
    ])

    if (error) {
      return { ok: false, error: 'Could not load marketplace revenue trend.' }
    }

    const dailyMap = new Map<string, { gmv: number; fees: number; orders: number }>()
    for (const key of buildBusinessDayKeysForPeriod(period.periodStartMs, period.periodEndMs)) {
      dailyMap.set(key, { gmv: 0, fees: 0, orders: 0 })
    }

    let totalGmv = 0
    let totalOrders = 0

    for (const row of orderRows ?? []) {
      const r = row as Record<string, unknown>
      const order = {
        amount: num(r.amount),
        shipping_amount: num(r.shipping_amount),
        platform_fee: num(r.platform_fee),
        status: String(r.status ?? ''),
        created_at: String(r.created_at ?? ''),
      }
      if (order.status !== 'confirmed') continue
      if (isHiddenFromAdminOverviewReport(order)) continue

      const bucket = dailyMap.get(businessDayKey(order.created_at))
      if (!bucket) continue
      const gmv = marketplaceGmvExcludingShippingUsd(order)
      bucket.gmv += gmv
      bucket.fees += order.platform_fee
      bucket.orders += 1
      totalGmv += gmv
      totalOrders += 1
    }

    for (const tip of tippedGms) {
      const ts = new Date(tip.succeededAt).getTime()
      if (ts < period.periodStartMs || ts >= period.periodEndMs) continue
      const bucket = dailyMap.get(businessDayKey(tip.succeededAt))
      if (!bucket) continue
      bucket.gmv += tip.listingPriceUsd
      totalGmv += tip.listingPriceUsd
    }

    const daily: AdminInsightsDailyPoint[] = Array.from(dailyMap.entries()).map(
      ([date, v]) => ({
        date,
        gmv: v.gmv,
        fees: v.fees,
        orders: v.orders,
      }),
    )
    const aggregation =
      (range === '90d' || range === 'ytd') && !options?.yearMonth ? 'month' : 'day'
    const monthly =
      aggregation === 'month'
        ? buildAdminRevenueMonthlyPoints(daily, { trimLeadingEmpty: range === 'ytd' })
        : []
    const insight =
      aggregation === 'month'
        ? buildAdminRevenuePaceInsight({ monthly, totalGmv, range })
        : null

    return {
      ok: true,
      data: {
        periodMode: period.mode,
        periodLabel: period.label,
        periodDays: period.periodDays,
        selectedYearMonth: period.mode === 'month' ? period.yearMonth : null,
        aggregation,
        daily,
        monthly,
        totalGmv,
        totalOrders,
        insight,
      },
    }
  } catch {
    return {
      ok: false,
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to load the admin revenue trend.',
    }
  }
}

// ---------------------------------------------------------------------------
// Day-over-day momentum matrix
// ---------------------------------------------------------------------------

/**
 * Trailing comparison windows for the day-over-day momentum matrix. Each metric's
 * most recent 24h ("today") is compared against the average daily run-rate of the
 * preceding window. A 1-day window is a literal day-over-day (vs yesterday).
 */
export const ADMIN_MOMENTUM_WINDOWS = [1, 3, 7, 10, 30] as const

const DAY_MS = 24 * 60 * 60 * 1000
const MOMENTUM_ROW_FETCH_CAP = 50000

/** Largest window drives how far back we fetch rows. */
const MOMENTUM_LOOKBACK_DAYS = Math.max(...ADMIN_MOMENTUM_WINDOWS) + 1

function momentumWindowLabel(windowDays: number): string {
  if (windowDays === 1) return 'vs yesterday'
  if (windowDays === 30) return 'vs 30-day avg'
  return `vs ${windowDays}-day avg`
}

/**
 * Buckets a stream of timestamped events into "today" (last 24h) and trailing
 * window totals. Each event contributes its `weight` (1 for counts, $ for money).
 */
function bucketByMomentumWindows(
  events: { ageMs: number; weight: number }[],
): { today: number; windowTotals: Map<number, number> } {
  let today = 0
  const windowTotals = new Map<number, number>()
  for (const w of ADMIN_MOMENTUM_WINDOWS) windowTotals.set(w, 0)

  for (const { ageMs, weight } of events) {
    if (ageMs < 0) continue
    if (ageMs < DAY_MS) {
      today += weight
      continue
    }
    for (const w of ADMIN_MOMENTUM_WINDOWS) {
      if (ageMs < (w + 1) * DAY_MS) {
        windowTotals.set(w, (windowTotals.get(w) ?? 0) + weight)
      }
    }
  }
  return { today, windowTotals }
}

function buildMomentumComparisons(
  today: number,
  windowTotals: Map<number, number>,
): MomentumComparison[] {
  return ADMIN_MOMENTUM_WINDOWS.map((windowDays) => {
    const windowTotal = windowTotals.get(windowDays) ?? 0
    const baselinePerDay = windowTotal / windowDays
    const deltaPct =
      baselinePerDay > 0 ? ((today - baselinePerDay) / baselinePerDay) * 100 : null
    return {
      windowDays,
      label: momentumWindowLabel(windowDays),
      windowTotal,
      baselinePerDay,
      deltaPct,
    }
  })
}

function momentumMetric(
  key: MomentumMetricKey,
  label: string,
  description: string,
  format: MomentumFormat,
  events: { ageMs: number; weight: number }[],
): MomentumMetric {
  const { today, windowTotals } = bucketByMomentumWindows(events)
  return { key, label, description, format, today, comparisons: buildMomentumComparisons(today, windowTotals) }
}

/** Sums up rolling-window search totals from cumulative Elasticsearch counts. */
async function loadSearchMomentumEvents(
  now: number,
): Promise<{ tracked: boolean; events: { ageMs: number; weight: number }[] }> {
  if (!isElasticsearchConfigured()) return { tracked: false, events: [] }

  // Cumulative search totals from `now` back to each boundary we need.
  const boundaries = Array.from(
    new Set([1, ...ADMIN_MOMENTUM_WINDOWS.map((w) => w + 1)]),
  ).sort((a, b) => a - b)
  const nowIso = new Date(now).toISOString()

  try {
    const cumulative = await Promise.all(
      boundaries.map((days) =>
        countMarketplaceSearchesInRange(new Date(now - days * DAY_MS).toISOString(), nowIso),
      ),
    )
    const cumulativeByDay = new Map<number, number>()
    boundaries.forEach((days, i) => cumulativeByDay.set(days, cumulative[i] ?? 0))

    // Re-expand cumulative totals into synthetic events placed at window midpoints
    // so the generic bucketing logic produces the same totals.
    const events: { ageMs: number; weight: number }[] = []
    const today = cumulativeByDay.get(1) ?? 0
    if (today > 0) events.push({ ageMs: 0.5 * DAY_MS, weight: today })
    for (const w of ADMIN_MOMENTUM_WINDOWS) {
      const trailing = (cumulativeByDay.get(w + 1) ?? 0) - today
      if (w === 1) {
        if (trailing > 0) events.push({ ageMs: 1.5 * DAY_MS, weight: trailing })
        continue
      }
      // Distribute the trailing total for this window into the day band it newly
      // covers vs the previous window so every window total stays exact.
      const prevWindow = ADMIN_MOMENTUM_WINDOWS[ADMIN_MOMENTUM_WINDOWS.indexOf(w) - 1]
      const prevTrailing = (cumulativeByDay.get(prevWindow + 1) ?? 0) - today
      const bandTotal = trailing - prevTrailing
      if (bandTotal > 0) {
        const ageMs = (prevWindow + 1 + (w - prevWindow) / 2) * DAY_MS
        events.push({ ageMs, weight: bandTotal })
      }
    }
    return { tracked: true, events }
  } catch {
    return { tracked: false, events: [] }
  }
}

/**
 * Day-over-day momentum matrix: the most recent 24h for each core metric compared
 * against the average daily run-rate over trailing 1/3/7/10/30-day windows.
 * Service-role aggregation (no staff RLS on `orders`); always omits admin-test
 * orders and the April low-value report exclusions.
 */
export async function loadAdminMomentumMatrix(): Promise<
  { ok: true; data: AdminMomentumMatrix } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()
    const now = Date.now()
    const sinceIso = new Date(now - MOMENTUM_LOOKBACK_DAYS * DAY_MS).toISOString()

    const [ordersRes, tippedGms, usersRes, listingsRes, searchResult] = await Promise.all([
      db
        .from('orders')
        .select('amount, shipping_amount, platform_fee, status, created_at')
        .eq('is_admin_test', false)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(MOMENTUM_ROW_FETCH_CAP),
      listTippedMarkSoldGmsContributions(db),
      db
        .from('profiles')
        .select('created_at')
        .gte('created_at', sinceIso)
        .limit(MOMENTUM_ROW_FETCH_CAP),
      db
        .from('listings')
        .select('created_at')
        .gte('created_at', sinceIso)
        .limit(MOMENTUM_ROW_FETCH_CAP),
      loadSearchMomentumEvents(now),
    ])

    if (ordersRes.error) {
      return { ok: false, error: 'Could not load orders for the momentum matrix.' }
    }

    const orderEvents: { ageMs: number; weight: number }[] = []
    const gmvEvents: { ageMs: number; weight: number }[] = []
    const revenueEvents: { ageMs: number; weight: number }[] = []
    for (const row of ordersRes.data ?? []) {
      const r = row as Record<string, unknown>
      const status = String(r.status ?? '')
      if (status !== 'confirmed') continue
      const createdAt = String(r.created_at ?? '')
      if (isHiddenFromAdminOverviewReport({ amount: num(r.amount), status, created_at: createdAt }))
        continue
      const ageMs = now - new Date(createdAt).getTime()
      orderEvents.push({ ageMs, weight: 1 })
      gmvEvents.push({
        ageMs,
        weight: marketplaceGmvExcludingShippingUsd({
          amount: num(r.amount),
          shipping_amount: num(r.shipping_amount),
        }),
      })
      revenueEvents.push({ ageMs, weight: num(r.platform_fee) })
    }

    for (const tip of tippedGms) {
      const ageMs = now - new Date(tip.succeededAt).getTime()
      gmvEvents.push({ ageMs, weight: tip.listingPriceUsd })
    }

    const toAgeEvents = (rows: unknown[] | null): { ageMs: number; weight: number }[] =>
      (rows ?? []).map((row) => {
        const r = row as Record<string, unknown>
        return { ageMs: now - new Date(String(r.created_at ?? '')).getTime(), weight: 1 }
      })

    const metrics: MomentumMetric[] = [
      momentumMetric('gmv', 'GMV', 'Merchandise sales excluding shipping', 'usd', gmvEvents),
      momentumMetric(
        'platformRevenue',
        'Reswell revenue',
        'Platform fees earned',
        'usd',
        revenueEvents,
      ),
      momentumMetric('paidOrders', 'Paid orders', 'Confirmed checkouts', 'count', orderEvents),
      momentumMetric('newUsers', 'New users', 'Profiles created', 'count', toAgeEvents(usersRes.data)),
      momentumMetric(
        'newListings',
        'New listings',
        'Listings created',
        'count',
        toAgeEvents(listingsRes.data),
      ),
    ]

    if (searchResult.tracked) {
      metrics.push(
        momentumMetric('searches', 'Searches', 'Marketplace searches', 'count', searchResult.events),
      )
    }

    return {
      ok: true,
      data: {
        generatedAt: new Date(now).toISOString(),
        searchesTracked: searchResult.tracked,
        windows: [...ADMIN_MOMENTUM_WINDOWS],
        metrics,
      },
    }
  } catch {
    return {
      ok: false,
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to compute the day-over-day momentum matrix.',
    }
  }
}

const MONTHLY_BREAKDOWN_DEFAULT_MONTHS = 12

/** Confirmed-order GMV and platform fees grouped by Pacific calendar month. */
export async function loadAdminMonthlyRevenueBreakdown(
  monthCount = MONTHLY_BREAKDOWN_DEFAULT_MONTHS,
): Promise<
  { ok: true; data: AdminMonthlyRevenueRow[] } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()
    const months = businessYearMonthChoices(monthCount)
    const earliestYm = months[months.length - 1]
    const sinceIso = earliestYm ? businessMonthStartIso(earliestYm) : null
    if (!sinceIso) {
      return { ok: true, data: [] }
    }

    const [{ data: orderRows, error }, tippedGms] = await Promise.all([
      db
        .from('orders')
        .select('amount, shipping_amount, platform_fee, promo_discount_usd, created_at, status')
        .eq('is_admin_test', false)
        .eq('status', 'confirmed')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(ORDERS_FETCH_CAP),
      listTippedMarkSoldGmsContributions(db),
    ])

    if (error) {
      return { ok: false, error: 'Could not load monthly revenue breakdown.' }
    }

    const bucket = new Map<
      string,
      {
        gmv: number
        platformRevenue: number
        marketingExpense: number
        orders: number
      }
    >()
    for (const ym of months) {
      bucket.set(ym, {
        gmv: 0,
        platformRevenue: 0,
        marketingExpense: 0,
        orders: 0,
      })
    }

    for (const row of orderRows ?? []) {
      const r = row as Record<string, unknown>
      const amount = num(r.amount)
      const shippingAmount = num(r.shipping_amount)
      const createdAt = String(r.created_at ?? '')
      const status = String(r.status ?? '')
      if (isHiddenFromAdminOverviewReport({ amount, created_at: createdAt, status })) continue
      const ym = businessDayKey(createdAt).slice(0, 7)
      const b = bucket.get(ym)
      if (!b) continue
      b.gmv += marketplaceGmvExcludingShippingUsd({
        amount,
        shipping_amount: shippingAmount,
      })
      b.platformRevenue += num(r.platform_fee)
      b.marketingExpense += marketplacePromoMarketingUsd({
        promo_discount_usd: num(r.promo_discount_usd),
      })
      b.orders += 1
    }

    for (const tip of tippedGms) {
      const ym = businessDayKey(tip.succeededAt).slice(0, 7)
      const b = bucket.get(ym)
      if (!b) continue
      b.gmv += tip.listingPriceUsd
    }

    const data: AdminMonthlyRevenueRow[] = months.map((yearMonth) => {
      const v = bucket.get(yearMonth) ?? {
        gmv: 0,
        platformRevenue: 0,
        marketingExpense: 0,
        orders: 0,
      }
      return {
        yearMonth,
        gmv: v.gmv,
        platformRevenue: v.platformRevenue,
        marketingExpense: v.marketingExpense,
        orders: v.orders,
      }
    })

    return { ok: true, data }
  } catch {
    return {
      ok: false,
      error:
        'Add SUPABASE_SERVICE_ROLE_KEY on the server to load monthly revenue breakdown.',
    }
  }
}
