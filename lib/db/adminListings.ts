import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminListingMonthlyCreatedRow = {
  month_key: string
  listing_count: number
}

/** PostgREST: RPC not exposed / not in schema cache (e.g. migration not applied yet). */
export function isAdminListingsMonthlyCreatedRpcUnavailable(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  if (error.code === 'PGRST202') return true
  const msg = error.message ?? ''
  return (
    msg.includes('get_admin_listings_monthly_created') &&
    (msg.includes('schema cache') || msg.includes('Could not find the function'))
  )
}

export async function fetchAdminListingsMonthlyCreated(
  supabase: SupabaseClient,
  months = 12,
): Promise<{ data: AdminListingMonthlyCreatedRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_admin_listings_monthly_created', {
    p_months: months,
  })

  if (error) {
    if (!isAdminListingsMonthlyCreatedRpcUnavailable(error)) {
      console.error('[admin listings] monthly created RPC:', error.message)
    }
    return { data: [], error: error.message }
  }

  const rows = (data ?? []) as { month_key: string; listing_count: number | string }[]
  return {
    data: rows.map((row) => ({
      month_key: row.month_key,
      listing_count: Number(row.listing_count) || 0,
    })),
    error: null,
  }
}

export function resolveAdminListingsMonthlyCreated(
  rpcResult: { data: AdminListingMonthlyCreatedRow[]; error: string | null },
  listings: { created_at: string; status: string }[],
  months = 12,
): AdminListingMonthlyCreatedRow[] {
  if (!rpcResult.error) return rpcResult.data
  return buildAdminListingsMonthlyCreatedFallback(listings, months)
}

/** Used when listing_creation_events migration is not applied yet. */
export function buildAdminListingsMonthlyCreatedFallback(
  listings: { created_at: string; status: string }[],
  months = 12,
): AdminListingMonthlyCreatedRow[] {
  const counts = new Map<string, number>()
  for (const listing of listings) {
    if (listing.status === 'draft') continue
    const created = new Date(listing.created_at)
    if (Number.isNaN(created.getTime())) continue
    const key = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows: AdminListingMonthlyCreatedRow[] = []
  const cursor = new Date()
  cursor.setUTCDate(1)
  cursor.setUTCHours(0, 0, 0, 0)
  cursor.setUTCMonth(cursor.getUTCMonth() - (months - 1))
  for (let i = 0; i < months; i += 1) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`
    rows.push({ month_key: key, listing_count: counts.get(key) ?? 0 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return rows
}
