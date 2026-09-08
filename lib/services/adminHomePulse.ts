import {
  countActiveMarketplaceListings,
  countConfirmedOrdersSince,
  countGiveawayEntriesByListing,
  countMarketplaceMessagesSince,
  countNewListingsSince,
  countNewUsersSince,
  countOpenPickupAwaitingCode,
  countOpenShippingAwaitingDropoff,
  countShippingLabelsCreatedSince,
  sumIncreasedShipEngineAdjustments,
} from '@/lib/db/adminHomePulse'
import { listSellerSaleTipAdminFacts } from '@/lib/db/sellerSaleTips'
import { isHiddenFromAdminOverviewReport } from '@/lib/admin/overview-report-orders'
import { isElasticsearchConfigured } from '@/lib/elasticsearch/config'
import { countMarketplaceSearchesInRange } from '@/lib/elasticsearch/search-analytics-index'
import { listCurrentGiveaways, listGiveaways } from '@/lib/giveaways/catalog'
import { marketplaceGmvExcludingShippingUsd } from '@/lib/seller-fees'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { shiftYearMonth } from '@/lib/utils/adminInsightsPeriod'
import {
  addBusinessDays,
  businessDayKeyFromMs,
  businessDayStartMs,
} from '@/lib/utils/business-timezone'

export type AdminHomePulseCounts = {
  newUsers: number
  newListings: number
  orders: number
  tippedMarkSold: number
  messages: number
  searches: number
  searchesTracked: boolean
  giveawayEntered: number
  giveawayNotEntered: number
  shippingLabels: number
}

export type AdminHomePulseCommerce = {
  gmv: number
  platformRevenue: number
  sales: number
}

export type AdminHomePulseOps = {
  openShipping: number
  openPickup: number
  adjustedLabels: number
  adjustedFeesUsd: number
}

export type AdminHomePulseSupply = {
  activeListings: number
  activeSurfboards: number
}

export type AdminHomePulse = {
  today: AdminHomePulseCounts
  week: AdminHomePulseCounts
  priorWeek: AdminHomePulseCounts
  todayCommerce: AdminHomePulseCommerce
  weekCommerce: AdminHomePulseCommerce
  priorWeekCommerce: AdminHomePulseCommerce
  monthCommerce: AdminHomePulseCommerce
  priorMonthToDateCommerce: AdminHomePulseCommerce
  supply: AdminHomePulseSupply
  ops: AdminHomePulseOps
}

function emptyCommerce(): AdminHomePulseCommerce {
  return { gmv: 0, platformRevenue: 0, sales: 0 }
}

function inWindow(iso: string, startMs: number, endMs: number): boolean {
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) && ts >= startMs && ts < endMs
}

async function loadPulseCounts(params: {
  db: ReturnType<typeof createServiceRoleClient>
  sinceIso: string
  untilIso?: string
  nowIso: string
  giveawaySlugs: string[]
}): Promise<AdminHomePulseCounts> {
  const searchesTracked = isElasticsearchConfigured()
  const searchUntil = params.untilIso ?? params.nowIso
  const [newUsers, newListings, orders, messages, searches, giveaway, shippingLabels] =
    await Promise.all([
      countNewUsersSince(params.db, params.sinceIso, params.untilIso),
      countNewListingsSince(params.db, params.sinceIso, params.untilIso),
      countConfirmedOrdersSince(params.db, params.sinceIso, params.untilIso),
      countMarketplaceMessagesSince(params.db, params.sinceIso, params.untilIso),
      searchesTracked
        ? countMarketplaceSearchesInRange(params.sinceIso, searchUntil)
        : Promise.resolve(null),
      params.untilIso
        ? Promise.resolve({ entered: 0, notEntered: 0 })
        : countGiveawayEntriesByListing(params.db, params.giveawaySlugs, params.sinceIso),
      countShippingLabelsCreatedSince(params.db, params.sinceIso),
    ])

  return {
    newUsers,
    newListings,
    orders,
    tippedMarkSold: 0,
    messages,
    searches: searches ?? 0,
    searchesTracked,
    giveawayEntered: giveaway.entered,
    giveawayNotEntered: giveaway.notEntered,
    shippingLabels,
  }
}

async function loadPulseOps(
  db: ReturnType<typeof createServiceRoleClient>,
): Promise<AdminHomePulseOps> {
  const [openShipping, openPickup, adjusted] = await Promise.all([
    countOpenShippingAwaitingDropoff(db),
    countOpenPickupAwaitingCode(db),
    sumIncreasedShipEngineAdjustments(db),
  ])
  return {
    openShipping,
    openPickup,
    adjustedLabels: adjusted.count,
    adjustedFeesUsd: adjusted.amountUsd,
  }
}

function addCommerce(
  target: AdminHomePulseCommerce,
  add: { gmv?: number; platformRevenue?: number; sales?: number },
) {
  target.gmv += add.gmv ?? 0
  target.platformRevenue += add.platformRevenue ?? 0
  target.sales += add.sales ?? 0
}

export async function loadAdminHomePulse(): Promise<
  { ok: true; data: AdminHomePulse } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()
    const now = Date.now()
    const todayKey = businessDayKeyFromMs(now)
    const todayStartMs = businessDayStartMs(todayKey)
    const weekStartMs = businessDayStartMs(addBusinessDays(todayKey, -6))
    const priorWeekStartMs = businessDayStartMs(addBusinessDays(todayKey, -13))
    const currentYm = todayKey.slice(0, 7)
    const priorYm = shiftYearMonth(currentYm, -1)
    const monthStartMs = businessDayStartMs(`${currentYm}-01`)
    const priorMonthStartMs = businessDayStartMs(`${priorYm}-01`)
    const elapsedMs = Math.max(0, now - monthStartMs)
    const priorMonthToDateEndMs = priorMonthStartMs + elapsedMs
    const fetchSinceMs = Math.min(priorWeekStartMs, priorMonthStartMs)
    const todayStartIso = new Date(todayStartMs).toISOString()
    const weekStartIso = new Date(weekStartMs).toISOString()
    const priorWeekStartIso = new Date(priorWeekStartMs).toISOString()
    const fetchSinceIso = new Date(fetchSinceMs).toISOString()
    const nowIso = new Date(now).toISOString()
    const currentGiveaways = listCurrentGiveaways(now)
    const giveawaySlugs = (currentGiveaways.length > 0 ? currentGiveaways : listGiveaways()).map(
      (giveaway) => giveaway.slug,
    )

    const [today, week, priorWeek, ops, tipFacts, recentOrders, supply] = await Promise.all([
      loadPulseCounts({ db, sinceIso: todayStartIso, nowIso, giveawaySlugs }),
      loadPulseCounts({ db, sinceIso: weekStartIso, nowIso, giveawaySlugs }),
      loadPulseCounts({
        db,
        sinceIso: priorWeekStartIso,
        untilIso: weekStartIso,
        nowIso,
        giveawaySlugs,
      }),
      loadPulseOps(db),
      listSellerSaleTipAdminFacts(db),
      db
        .from('orders')
        .select('amount, shipping_amount, platform_fee, status, created_at')
        .eq('is_admin_test', false)
        .eq('status', 'confirmed')
        .gte('created_at', fetchSinceIso)
        .limit(8000),
      countActiveMarketplaceListings(db),
    ])

    const todayCommerce = emptyCommerce()
    const weekCommerce = emptyCommerce()
    const priorWeekCommerce = emptyCommerce()
    const monthCommerce = emptyCommerce()
    const priorMonthToDateCommerce = emptyCommerce()

    for (const row of recentOrders.data ?? []) {
      const r = row as Record<string, unknown>
      const createdAt = String(r.created_at ?? '')
      const status = String(r.status ?? '')
      const amount = Number(r.amount ?? 0)
      if (isHiddenFromAdminOverviewReport({ amount, status, created_at: createdAt })) continue
      const gmv = marketplaceGmvExcludingShippingUsd({
        amount,
        shipping_amount: Number(r.shipping_amount ?? 0),
      })
      const fee = Number(r.platform_fee ?? 0)
      if (inWindow(createdAt, todayStartMs, now)) {
        addCommerce(todayCommerce, { gmv, platformRevenue: fee, sales: 1 })
      }
      if (inWindow(createdAt, weekStartMs, now)) {
        addCommerce(weekCommerce, { gmv, platformRevenue: fee, sales: 1 })
      }
      if (inWindow(createdAt, priorWeekStartMs, weekStartMs)) {
        addCommerce(priorWeekCommerce, { gmv, platformRevenue: fee, sales: 1 })
      }
      if (inWindow(createdAt, monthStartMs, now)) {
        addCommerce(monthCommerce, { gmv, platformRevenue: fee, sales: 1 })
      }
      if (inWindow(createdAt, priorMonthStartMs, priorMonthToDateEndMs)) {
        addCommerce(priorMonthToDateCommerce, { gmv, platformRevenue: fee, sales: 1 })
      }
    }

    for (const tip of tipFacts.gms) {
      if (inWindow(tip.succeededAt, todayStartMs, now)) {
        today.tippedMarkSold += 1
        addCommerce(todayCommerce, { gmv: tip.listingPriceUsd, sales: 1 })
      }
      if (inWindow(tip.succeededAt, weekStartMs, now)) {
        week.tippedMarkSold += 1
        addCommerce(weekCommerce, { gmv: tip.listingPriceUsd, sales: 1 })
      }
      if (inWindow(tip.succeededAt, priorWeekStartMs, weekStartMs)) {
        priorWeek.tippedMarkSold += 1
        addCommerce(priorWeekCommerce, { gmv: tip.listingPriceUsd, sales: 1 })
      }
      if (inWindow(tip.succeededAt, monthStartMs, now)) {
        addCommerce(monthCommerce, { gmv: tip.listingPriceUsd, sales: 1 })
      }
      if (inWindow(tip.succeededAt, priorMonthStartMs, priorMonthToDateEndMs)) {
        addCommerce(priorMonthToDateCommerce, { gmv: tip.listingPriceUsd, sales: 1 })
      }
    }

    for (const tip of tipFacts.tipRevenues) {
      if (inWindow(tip.succeededAt, todayStartMs, now)) {
        addCommerce(todayCommerce, { platformRevenue: tip.amountUsd })
      }
      if (inWindow(tip.succeededAt, weekStartMs, now)) {
        addCommerce(weekCommerce, { platformRevenue: tip.amountUsd })
      }
      if (inWindow(tip.succeededAt, priorWeekStartMs, weekStartMs)) {
        addCommerce(priorWeekCommerce, { platformRevenue: tip.amountUsd })
      }
      if (inWindow(tip.succeededAt, monthStartMs, now)) {
        addCommerce(monthCommerce, { platformRevenue: tip.amountUsd })
      }
      if (inWindow(tip.succeededAt, priorMonthStartMs, priorMonthToDateEndMs)) {
        addCommerce(priorMonthToDateCommerce, { platformRevenue: tip.amountUsd })
      }
    }

    return {
      ok: true,
      data: {
        today,
        week,
        priorWeek,
        todayCommerce,
        weekCommerce,
        priorWeekCommerce,
        monthCommerce,
        priorMonthToDateCommerce,
        supply: {
          activeListings: supply.listings,
          activeSurfboards: supply.surfboards,
        },
        ops,
      },
    }
  } catch {
    return {
      ok: false,
      error: 'Could not load today’s site pulse.',
    }
  }
}
