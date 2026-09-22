import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminListingsListQuery } from '@/lib/validations/admin-listings-list'

const LISTING_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ADMIN_LISTINGS_SELECT = `
  id, user_id, slug, title, price, status, section, views, created_at,
  category_id,
  brand, model, brand_id, brand_model_id,
  hidden_from_site,
  profiles!listings_user_id_fkey(display_name, email),
  categories(name, slug),
  listing_images(url)
`

const ADMIN_LISTINGS_SELECT_WITHOUT_HIDDEN = `
  id, user_id, slug, title, price, status, section, views, created_at,
  category_id,
  brand, model, brand_id, brand_model_id,
  profiles!listings_user_id_fkey(display_name, email),
  categories(name, slug),
  listing_images(url)
`

export type AdminListingsStats = {
  total: number
  active: number
  sold: number
  hidden: number
}

export type AdminListingsPageResult = {
  rows: Record<string, unknown>[]
  total: number
  error: string | null
}

export function escapeAdminListingsIlikePattern(raw: string): string {
  return raw.replace(/[%_\\"]/g, (m) => (m === '"' ? '' : `\\${m}`))
}

export function buildAdminListingsSearchOrFilter(
  q: string,
  sellerUserIds: string[],
): { kind: 'id'; id: string } | { kind: 'or'; filter: string } | { kind: 'none' } {
  const trimmed = q.trim()
  if (!trimmed) return { kind: 'none' }
  if (LISTING_ID_RE.test(trimmed)) return { kind: 'id', id: trimmed }

  const like = `%${escapeAdminListingsIlikePattern(trimmed)}%`
  const parts = [
    `title.ilike."${like}"`,
    `brand.ilike."${like}"`,
    `model.ilike."${like}"`,
    `slug.ilike."${like}"`,
  ]
  const ids = sellerUserIds.filter((id) => LISTING_ID_RE.test(id))
  if (ids.length > 0) {
    parts.push(`user_id.in.(${ids.join(',')})`)
  }
  return { kind: 'or', filter: parts.join(',') }
}

function isMissingHiddenColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  const msg = error.message ?? ''
  return msg.includes('hidden_from_site') || msg.includes('does not exist')
}

async function findSellerIdsForAdminListingSearch(
  supabase: SupabaseClient,
  q: string,
): Promise<string[]> {
  const trimmed = q.trim()
  if (!trimmed || LISTING_ID_RE.test(trimmed)) return []

  const like = `%${escapeAdminListingsIlikePattern(trimmed)}%`
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .or(`display_name.ilike."${like}",email.ilike."${like}"`)
    .limit(80)

  if (error) {
    console.error('[admin listings] seller search:', error.message)
    return []
  }
  return (data ?? [])
    .map((row) => String((row as { id?: string }).id ?? ''))
    .filter((id) => LISTING_ID_RE.test(id))
}

async function runAdminListingsPageQuery(
  supabase: SupabaseClient,
  params: AdminListingsListQuery,
  select: string,
  includeHiddenColumn: boolean,
  search: ReturnType<typeof buildAdminListingsSearchOrFilter>,
): Promise<{ rows: Record<string, unknown>[] | null; total: number; error: { code?: string; message?: string } | null }> {
  let query = supabase
    .from('listings')
    .select(select, { count: 'exact' })
    .order(params.sort, { ascending: params.dir === 'asc' })
    .range(params.offset, params.offset + params.limit - 1)

  if (params.status !== 'all') query = query.eq('status', params.status)
  if (params.section !== 'all') query = query.eq('section', params.section)
  if (includeHiddenColumn) {
    if (params.visibility === 'hidden') query = query.eq('hidden_from_site', true)
    if (params.visibility === 'visible') {
      query = query.not('hidden_from_site', 'eq', true)
    }
  }

  if (search.kind === 'id') {
    query = query.eq('id', search.id)
  } else if (search.kind === 'or') {
    query = query.or(search.filter)
  }

  const { data, error, count } = await query
  return {
    rows: (data ?? null) as Record<string, unknown>[] | null,
    total: count ?? 0,
    error,
  }
}

export async function fetchAdminListingsStats(
  supabase: SupabaseClient,
): Promise<AdminListingsStats> {
  const [totalRes, activeRes, soldRes, hiddenRes] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'sold'),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('hidden_from_site', true),
  ])

  if (totalRes.error) console.error('[admin listings] stats total:', totalRes.error.message)
  if (activeRes.error) console.error('[admin listings] stats active:', activeRes.error.message)
  if (soldRes.error) console.error('[admin listings] stats sold:', soldRes.error.message)
  if (hiddenRes.error && !isMissingHiddenColumnError(hiddenRes.error)) {
    console.error('[admin listings] stats hidden:', hiddenRes.error.message)
  }

  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    sold: soldRes.count ?? 0,
    hidden: hiddenRes.error ? 0 : (hiddenRes.count ?? 0),
  }
}

export async function listAdminListingsPage(
  supabase: SupabaseClient,
  params: AdminListingsListQuery,
): Promise<AdminListingsPageResult> {
  const sellerUserIds = await findSellerIdsForAdminListingSearch(supabase, params.q)
  const search = buildAdminListingsSearchOrFilter(params.q, sellerUserIds)

  const first = await runAdminListingsPageQuery(
    supabase,
    params,
    ADMIN_LISTINGS_SELECT,
    true,
    search,
  )

  if (!first.error) {
    return { rows: first.rows ?? [], total: first.total, error: null }
  }

  if (!isMissingHiddenColumnError(first.error)) {
    console.error('[admin listings] list:', first.error.message)
    return { rows: [], total: 0, error: 'Failed to load listings' }
  }

  const retry = await runAdminListingsPageQuery(
    supabase,
    params,
    ADMIN_LISTINGS_SELECT_WITHOUT_HIDDEN,
    false,
    search,
  )
  if (retry.error) {
    console.error('[admin listings] list retry:', retry.error.message)
    return { rows: [], total: 0, error: 'Failed to load listings' }
  }

  return {
    rows: (retry.rows ?? []).map((row) => ({ ...row, hidden_from_site: false })),
    total: retry.total,
    error: null,
  }
}


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
