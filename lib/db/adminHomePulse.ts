import type { SupabaseClient } from '@supabase/supabase-js'

export async function countNewUsersSince(db: SupabaseClient, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (error) {
    console.error('[adminHomePulse] profiles count failed', error.message)
    return 0
  }
  return count ?? 0
}

export async function countNewListingsSince(db: SupabaseClient, sinceIso: string): Promise<number> {
  const { count, error } = await db
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (error) {
    console.error('[adminHomePulse] listings count failed', error.message)
    return 0
  }
  return count ?? 0
}

export async function countConfirmedOrdersSince(
  db: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin_test', false)
    .eq('status', 'confirmed')
    .gte('created_at', sinceIso)
  if (error) {
    console.error('[adminHomePulse] orders count failed', error.message)
    return 0
  }
  return count ?? 0
}

export async function countMarketplaceMessagesSince(
  db: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await db
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceIso)
  if (error) {
    console.error('[adminHomePulse] messages count failed', error.message)
    return 0
  }
  return count ?? 0
}

export async function countGiveawayEntriesByListing(
  db: SupabaseClient,
  slugs: string[],
  sinceIso: string,
): Promise<{ entered: number; notEntered: number }> {
  if (slugs.length === 0) return { entered: 0, notEntered: 0 }

  const [entered, notEntered] = await Promise.all([
    db
      .from('giveaway_entries')
      .select('*', { count: 'exact', head: true })
      .in('giveaway_slug', slugs)
      .not('listing_id', 'is', null)
      .or(`qualified_at.gte.${sinceIso},created_at.gte.${sinceIso}`),
    db
      .from('giveaway_entries')
      .select('*', { count: 'exact', head: true })
      .in('giveaway_slug', slugs)
      .is('listing_id', null)
      .gte('created_at', sinceIso),
  ])

  if (entered.error) {
    console.error('[adminHomePulse] giveaway entered count failed', entered.error.message)
  }
  if (notEntered.error) {
    console.error('[adminHomePulse] giveaway not-entered count failed', notEntered.error.message)
  }

  return {
    entered: entered.count ?? 0,
    notEntered: notEntered.count ?? 0,
  }
}

/**
 * Confirmed shipping orders that are not closed yet.
 * Same bucket as `/admin/orders` open shipping: labeled or not, pending or
 * in transit, until delivered / picked up.
 */
export async function countOpenShippingAwaitingDropoff(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin_test', false)
    .eq('status', 'confirmed')
    .eq('fulfillment_method', 'shipping')
    .in('delivery_status', ['pending', 'shipped'])

  if (error) {
    console.error('[adminHomePulse] open shipping count failed', error.message)
    return 0
  }
  return count ?? 0
}

/** Confirmed local-pickup orders where the seller has not entered the buyer code. */
export async function countOpenPickupAwaitingCode(db: SupabaseClient): Promise<number> {
  const { count, error } = await db
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('is_admin_test', false)
    .eq('status', 'confirmed')
    .eq('fulfillment_method', 'pickup')
    .neq('delivery_status', 'picked_up')
  if (error) {
    console.error('[adminHomePulse] open pickup count failed', error.message)
    return 0
  }
  return count ?? 0
}

const LABEL_TABLES = [
  'order_shipping_labels',
  'order_admin_shipping_labels',
  'admin_user_shipping_labels',
] as const

/** Labels created across marketplace automation, admin order labels, and member labels. */
export async function countShippingLabelsCreatedSince(
  db: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const results = await Promise.all(
    LABEL_TABLES.map((table) =>
      db.from(table).select('*', { count: 'exact', head: true }).gte('created_at', sinceIso),
    ),
  )
  let total = 0
  for (let i = 0; i < results.length; i += 1) {
    const res = results[i]
    if (res.error) {
      console.error(`[adminHomePulse] ${LABEL_TABLES[i]} count failed`, res.error.message)
      continue
    }
    total += res.count ?? 0
  }
  return total
}

export async function sumIncreasedShipEngineAdjustments(
  db: SupabaseClient,
): Promise<{ count: number; amountUsd: number }> {
  const pageSize = 1000
  let amountUsd = 0
  let total = 0
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error, count } = await db
      .from('shipengine_label_adjustments')
      .select('adjustment_amount_usd', { count: from === 0 ? 'exact' : undefined })
      .gt('adjustment_amount_usd', 0)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[adminHomePulse] adjusted labels count failed', error.message)
      return { count: 0, amountUsd: 0 }
    }
    if (from === 0) total = count ?? 0
    for (const row of data ?? []) {
      const n = Number(
        (row as { adjustment_amount_usd: number | string | null }).adjustment_amount_usd,
      )
      if (Number.isFinite(n) && n > 0) amountUsd += n
    }
    if (!data || data.length < pageSize) break
  }

  return { count: total, amountUsd: Math.round(amountUsd * 100) / 100 }
}
