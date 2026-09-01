import type { SupabaseClient } from "@supabase/supabase-js"

import { isHiddenFromAdminOverviewReport } from "@/lib/admin/overview-report-orders"
import { listTippedMarkSoldGmsContributions } from "@/lib/db/sellerSaleTips"
import type {
  IntelligenceCommerceSnapshot,
  IntelligenceDailyPoint,
  IntelligenceGrowthSnapshot,
  IntelligenceMonthlyHistoryRow,
  IntelligenceTopPath,
} from "@/lib/types/businessIntelligence"
import { marketplaceGmvExcludingShippingUsd, marketplaceListingItemGmvUsd, marketplacePromoMarketingUsd } from "@/lib/seller-fees"
import { businessDayKey } from "@/lib/utils/business-timezone"
import { businessMonthStartIso, businessYearMonthChoices } from "@/lib/utils/adminInsightsPeriod"
import type { IntelligencePeriodResolved } from "@/lib/utils/businessIntelligencePeriod"
import { intelligenceTrend } from "@/lib/utils/intelligence-trend"

const ORDERS_FETCH_CAP = 20000
const PATH_FETCH_CAP = 12000
const LISTING_LOOKUP_CHUNK = 200

type OrderRow = {
  id: string
  amount: number
  platform_fee: number
  shipping_amount: number
  seller_earnings: number | null
  promo_discount_usd: number
  status: string
  created_at: string
  listing_id: string | null
}

function num(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

async function fetchListingMeta(
  db: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, { section: string; brand: string | null }>> {
  const meta = new Map<string, { section: string; brand: string | null }>()
  for (let i = 0; i < listingIds.length; i += LISTING_LOOKUP_CHUNK) {
    const chunk = listingIds.slice(i, i + LISTING_LOOKUP_CHUNK)
    const { data, error } = await db.from("listings").select("id, section, brand").in("id", chunk)
    if (error || !data) continue
    for (const row of data) {
      const r = row as Record<string, unknown>
      meta.set(String(r.id), {
        section: String(r.section ?? "unknown"),
        brand: r.brand == null || r.brand === "" ? null : String(r.brand),
      })
    }
  }
  return meta
}

export async function fetchIntelligenceCommerce(
  db: SupabaseClient,
  period: IntelligencePeriodResolved,
): Promise<IntelligenceCommerceSnapshot> {
  const [{ data, error }, tippedGms] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, amount, platform_fee, shipping_amount, seller_earnings, promo_discount_usd, status, created_at, listing_id",
      )
      .eq("is_admin_test", false)
      .gte("created_at", period.prevFromIso)
      .lt("created_at", period.toIsoExclusive)
      .order("created_at", { ascending: false })
      .limit(ORDERS_FETCH_CAP),
    listTippedMarkSoldGmsContributions(db),
  ])

  if (error) {
    throw new Error("Could not load marketplace orders for intelligence.")
  }

  const orders: OrderRow[] = (data ?? [])
    .map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id ?? ""),
        amount: num(r.amount),
        platform_fee: num(r.platform_fee),
        shipping_amount: num(r.shipping_amount),
        seller_earnings: r.seller_earnings == null ? null : num(r.seller_earnings),
        promo_discount_usd: num(r.promo_discount_usd),
        status: String(r.status ?? ""),
        created_at: String(r.created_at ?? ""),
        listing_id: r.listing_id == null ? null : String(r.listing_id),
      }
    })
    .filter((o) => !isHiddenFromAdminOverviewReport(o))

  const periodStartMs = new Date(period.fromIso).getTime()
  const periodEndMs = new Date(period.toIsoExclusive).getTime()
  const prevStartMs = new Date(period.prevFromIso).getTime()
  const prevEndMs = new Date(period.prevToIsoExclusive).getTime()

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
  const listingAgg = new Map<string, { gmv: number; orders: number }>()
  const dailyMap = new Map<string, IntelligenceDailyPoint>()

  for (const o of orders) {
    const ts = new Date(o.created_at).getTime()
    const inCurrent = ts >= periodStartMs && ts < periodEndMs
    const inPrevious = ts >= prevStartMs && ts < prevEndMs
    const confirmed = o.status === "confirmed"
    const refunded = o.status === "refunded" || o.status === "refunding"

    if (confirmed && inCurrent) {
      const gmv = marketplaceGmvExcludingShippingUsd(o)
      gmvCur += gmv
      listingItemGmvCur += marketplaceListingItemGmvUsd(o)
      feesCur += o.platform_fee
      promoCur += marketplacePromoMarketingUsd(o)
      ordersCur += 1
      const day = businessDayKey(o.created_at)
      const bucket = dailyMap.get(day) ?? { date: day, gmv: 0, fees: 0, orders: 0 }
      bucket.gmv += gmv
      bucket.fees += o.platform_fee
      bucket.orders += 1
      dailyMap.set(day, bucket)
      if (o.listing_id) {
        const l = listingAgg.get(o.listing_id) ?? { gmv: 0, orders: 0 }
        l.gmv += gmv
        l.orders += 1
        listingAgg.set(o.listing_id, l)
      }
    } else if (confirmed && inPrevious) {
      gmvPrev += marketplaceGmvExcludingShippingUsd(o)
      feesPrev += o.platform_fee
      promoPrev += marketplacePromoMarketingUsd(o)
      ordersPrev += 1
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
      const day = businessDayKey(tip.succeededAt)
      const bucket = dailyMap.get(day) ?? { date: day, gmv: 0, fees: 0, orders: 0 }
      bucket.gmv += tip.listingPriceUsd
      dailyMap.set(day, bucket)
      const l = listingAgg.get(tip.listingId) ?? { gmv: 0, orders: 0 }
      l.gmv += tip.listingPriceUsd
      l.orders += 1
      listingAgg.set(tip.listingId, l)
    } else if (inPrevious) {
      gmvPrev += tip.listingPriceUsd
    }
  }

  const listingMeta = await fetchListingMeta(db, Array.from(listingAgg.keys()))
  const brandAgg = new Map<string, { gmv: number; orders: number }>()
  const sectionAgg = new Map<string, { gmv: number; orders: number }>()
  for (const [listingId, agg] of listingAgg.entries()) {
    const meta = listingMeta.get(listingId)
    const brand = meta?.brand ?? "Unbranded"
    const section = meta?.section ?? "unknown"
    const b = brandAgg.get(brand) ?? { gmv: 0, orders: 0 }
    b.gmv += agg.gmv
    b.orders += agg.orders
    brandAgg.set(brand, b)
    const s = sectionAgg.get(section) ?? { gmv: 0, orders: 0 }
    s.gmv += agg.gmv
    s.orders += agg.orders
    sectionAgg.set(section, s)
  }

  const topBrands = Array.from(brandAgg.entries())
    .map(([brand, v]) => ({ brand, gmv: v.gmv, orders: v.orders }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 8)

  const sectionTotalGmv = Array.from(sectionAgg.values()).reduce((sum, v) => sum + v.gmv, 0)
  const sectionMix = Array.from(sectionAgg.entries())
    .map(([section, v]) => ({
      section,
      gmv: v.gmv,
      orders: v.orders,
      share: sectionTotalGmv > 0 ? (v.gmv / sectionTotalGmv) * 100 : 0,
    }))
    .sort((a, b) => b.gmv - a.gmv)

  const refundDenom = ordersCur + refundedCur

  return {
    gmv: intelligenceTrend(gmvCur, gmvPrev),
    platformRevenue: intelligenceTrend(feesCur, feesPrev),
    marketingExpense: intelligenceTrend(promoCur, promoPrev),
    orders: intelligenceTrend(ordersCur, ordersPrev),
    aov: intelligenceTrend(aovCur, aovPrev),
    takeRatePct: listingItemGmvCur > 0 ? (feesCur / listingItemGmvCur) * 100 : null,
    refundRatePct: refundDenom > 0 ? (refundedCur / refundDenom) * 100 : 0,
    refundCount: refundedCur,
    topBrands,
    sectionMix,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
  }
}

export async function fetchIntelligenceGrowth(
  db: SupabaseClient,
  period: IntelligencePeriodResolved,
  soldInPeriod: number,
): Promise<IntelligenceGrowthSnapshot> {
  const [
    usersCurRes,
    usersPrevRes,
    listingsCurRes,
    listingsPrevRes,
    supportCurRes,
    supportPrevRes,
    activeListingsRes,
    activeSurfboardsRes,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.fromIso)
      .lt("created_at", period.toIsoExclusive),
    db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.prevFromIso)
      .lt("created_at", period.prevToIsoExclusive),
    db
      .from("listings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.fromIso)
      .lt("created_at", period.toIsoExclusive),
    db
      .from("listings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.prevFromIso)
      .lt("created_at", period.prevToIsoExclusive),
    db
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.fromIso)
      .lt("created_at", period.toIsoExclusive),
    db
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", period.prevFromIso)
      .lt("created_at", period.prevToIsoExclusive),
    db.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    db
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false),
  ])

  const usersCur = usersCurRes.count ?? 0
  const activeSurfboards = activeSurfboardsRes.count ?? 0
  const sellDenom = soldInPeriod + activeSurfboards

  return {
    newUsers: intelligenceTrend(usersCur, usersPrevRes.count ?? 0),
    newListings: intelligenceTrend(listingsCurRes.count ?? 0, listingsPrevRes.count ?? 0),
    activeListings: activeListingsRes.count ?? 0,
    activeSurfboards,
    soldInPeriod,
    sellThroughPct: sellDenom > 0 ? (soldInPeriod / sellDenom) * 100 : null,
    newSupportThreads: intelligenceTrend(supportCurRes.count ?? 0, supportPrevRes.count ?? 0),
  }
}

export async function fetchIntelligenceTopFirstPartyPaths(
  db: SupabaseClient,
  period: IntelligencePeriodResolved,
  limit = 15,
): Promise<IntelligenceTopPath[]> {
  const { data, error } = await db
    .from("site_traffic_page_views")
    .select("pathname")
    .gte("occurred_at", period.fromIso)
    .lt("occurred_at", period.toIsoExclusive)
    .limit(PATH_FETCH_CAP)

  if (error || !data) return []

  const counts = new Map<string, number>()
  for (const row of data) {
    const path = typeof row.pathname === "string" ? row.pathname.trim() : ""
    if (!path || path.startsWith("/admin")) continue
    counts.set(path, (counts.get(path) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([path, views]) => ({ path, views }))
}

export async function fetchIntelligenceMonthlyHistory(
  db: SupabaseClient,
  monthCount = 12,
): Promise<IntelligenceMonthlyHistoryRow[]> {
  const months = businessYearMonthChoices(monthCount)
  const earliest = months[months.length - 1]
  if (!earliest) return []
  const sinceIso = businessMonthStartIso(earliest)
  if (!sinceIso) return []

  const [ordersRes, tippedGms, usersRes, listingsRes] = await Promise.all([
    db
      .from("orders")
      .select("amount, shipping_amount, platform_fee, promo_discount_usd, created_at, status")
      .eq("is_admin_test", false)
      .eq("status", "confirmed")
      .gte("created_at", sinceIso)
      .limit(ORDERS_FETCH_CAP),
    listTippedMarkSoldGmsContributions(db),
    db.from("profiles").select("created_at").gte("created_at", sinceIso).limit(ORDERS_FETCH_CAP),
    db.from("listings").select("created_at").gte("created_at", sinceIso).limit(ORDERS_FETCH_CAP),
  ])

  const bucket = new Map<string, IntelligenceMonthlyHistoryRow>()
  for (const yearMonth of months) {
    bucket.set(yearMonth, {
      yearMonth,
      gmv: 0,
      platformRevenue: 0,
      marketingExpense: 0,
      orders: 0,
      users: 0,
      listings: 0,
    })
  }

  for (const row of ordersRes.data ?? []) {
    const r = row as Record<string, unknown>
    const createdAt = String(r.created_at ?? "")
    const status = String(r.status ?? "")
    if (
      isHiddenFromAdminOverviewReport({
        amount: num(r.amount),
        created_at: createdAt,
        status,
      })
    ) {
      continue
    }
    const ym = businessDayKey(createdAt).slice(0, 7)
    const b = bucket.get(ym)
    if (!b) continue
    b.gmv += marketplaceGmvExcludingShippingUsd({
      amount: num(r.amount),
      shipping_amount: num(r.shipping_amount),
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
  for (const row of usersRes.data ?? []) {
    const ym = businessDayKey(String((row as { created_at?: string }).created_at ?? "")).slice(0, 7)
    const b = bucket.get(ym)
    if (b) b.users += 1
  }
  for (const row of listingsRes.data ?? []) {
    const ym = businessDayKey(String((row as { created_at?: string }).created_at ?? "")).slice(0, 7)
    const b = bucket.get(ym)
    if (b) b.listings += 1
  }

  return months.map(
    (yearMonth) =>
      bucket.get(yearMonth) ?? {
        yearMonth,
        gmv: 0,
        platformRevenue: 0,
        marketingExpense: 0,
        orders: 0,
        users: 0,
        listings: 0,
      },
  )
}
