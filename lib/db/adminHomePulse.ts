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
