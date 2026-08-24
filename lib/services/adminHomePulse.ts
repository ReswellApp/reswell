import {
  countConfirmedOrdersSince,
  countGiveawayEntriesByListing,
  countMarketplaceMessagesSince,
  countNewListingsSince,
  countNewUsersSince,
} from '@/lib/db/adminHomePulse'
import { isElasticsearchConfigured } from '@/lib/elasticsearch/config'
import { countMarketplaceSearchesInRange } from '@/lib/elasticsearch/search-analytics-index'
import { listCurrentGiveaways, listGiveaways } from '@/lib/giveaways/catalog'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  addBusinessDays,
  businessDayKeyFromMs,
  businessDayStartMs,
} from '@/lib/utils/business-timezone'

export type AdminHomePulseCounts = {
  newUsers: number
  newListings: number
  orders: number
  messages: number
  searches: number
  searchesTracked: boolean
  giveawayEntered: number
  giveawayNotEntered: number
}

export type AdminHomePulse = {
  today: AdminHomePulseCounts
  week: AdminHomePulseCounts
}

async function loadPulseCounts(params: {
  db: ReturnType<typeof createServiceRoleClient>
  sinceIso: string
  nowIso: string
  giveawaySlugs: string[]
}): Promise<AdminHomePulseCounts> {
  const searchesTracked = isElasticsearchConfigured()
  const [newUsers, newListings, orders, messages, searches, giveaway] = await Promise.all([
    countNewUsersSince(params.db, params.sinceIso),
    countNewListingsSince(params.db, params.sinceIso),
    countConfirmedOrdersSince(params.db, params.sinceIso),
    countMarketplaceMessagesSince(params.db, params.sinceIso),
    searchesTracked
      ? countMarketplaceSearchesInRange(params.sinceIso, params.nowIso)
      : Promise.resolve(null),
    countGiveawayEntriesByListing(params.db, params.giveawaySlugs, params.sinceIso),
  ])

  return {
    newUsers,
    newListings,
    orders,
    messages,
    searches: searches ?? 0,
    searchesTracked,
    giveawayEntered: giveaway.entered,
    giveawayNotEntered: giveaway.notEntered,
  }
}

export async function loadAdminHomePulse(): Promise<
  { ok: true; data: AdminHomePulse } | { ok: false; error: string }
> {
  try {
    const db = createServiceRoleClient()
    const now = Date.now()
    const todayKey = businessDayKeyFromMs(now)
    const todayStartIso = new Date(businessDayStartMs(todayKey)).toISOString()
    const weekStartIso = new Date(businessDayStartMs(addBusinessDays(todayKey, -6))).toISOString()
    const nowIso = new Date(now).toISOString()
    const currentGiveaways = listCurrentGiveaways(now)
    const giveawaySlugs = (currentGiveaways.length > 0 ? currentGiveaways : listGiveaways()).map(
      (giveaway) => giveaway.slug,
    )

    const [today, week] = await Promise.all([
      loadPulseCounts({ db, sinceIso: todayStartIso, nowIso, giveawaySlugs }),
      loadPulseCounts({ db, sinceIso: weekStartIso, nowIso, giveawaySlugs }),
    ])

    return { ok: true, data: { today, week } }
  } catch {
    return {
      ok: false,
      error: 'Could not load today’s site pulse.',
    }
  }
}
