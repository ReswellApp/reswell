import { listTippedMarkSoldGmsContributions } from '@/lib/db/sellerSaleTips'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Marketplace-wide user directory for the admin users console.
 *
 * Runs on the **service-role** client so listing and order aggregates are
 * accurate regardless of RLS, and replaces the previous per-user N+1 count
 * queries with three bulk reads tallied in memory. Money is USD; sales/GMV
 * use confirmed, non-test orders plus listing prices of off-platform
 * mark-as-sold sales with a succeeded seller tip.
 */

const PAGE = 1000
const MAX_ROWS = 50000

export type AdminUserDirectoryRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  is_admin: boolean
  is_employee: boolean
  shop_verified: boolean
  is_reswell_seller: boolean
  created_at: string
  listings_count: number
  active_listings_count: number
  draft_listings_count: number
  sales_count: number
  gmv: number
}

export type AdminUsersDirectory = {
  users: AdminUserDirectoryRow[]
  generatedAt: string
}

type PageResult<T> = { data: T[] | null; error: { message: string } | null }

async function fetchAll<T>(run: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function num(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  is_admin: boolean | null
  is_employee: boolean | null
  shop_verified: boolean | null
  is_reswell_seller: boolean | null
  created_at: string
}

type ListingRow = { user_id: string | null; status: string | null }
type OrderRow = {
  seller_id: string | null
  amount: number | null
  status: string | null
  is_admin_test: boolean | null
}

export async function loadAdminUsersDirectory(): Promise<
  { ok: true; data: AdminUsersDirectory } | { ok: false; error: string }
> {
  let db: ReturnType<typeof createServiceRoleClient>
  try {
    db = createServiceRoleClient()
  } catch {
    return {
      ok: false,
      error: 'Add SUPABASE_SERVICE_ROLE_KEY on the server to load the user directory.',
    }
  }

  try {
    const [profiles, listings, orders, tippedGms] = await Promise.all([
      fetchAll<ProfileRow>((from, to) =>
        db
          .from('profiles')
          .select(
            'id, email, display_name, avatar_url, city, is_admin, is_employee, shop_verified, is_reswell_seller, created_at',
          )
          .order('created_at', { ascending: false })
          .range(from, to),
      ),
      fetchAll<ListingRow>((from, to) =>
        db.from('listings').select('user_id, status').range(from, to),
      ),
      fetchAll<OrderRow>((from, to) =>
        db.from('orders').select('seller_id, amount, status, is_admin_test').range(from, to),
      ),
      listTippedMarkSoldGmsContributions(db),
    ])

    const listingMap = new Map<string, { total: number; active: number; draft: number }>()
    for (const l of listings) {
      if (!l.user_id) continue
      const agg = listingMap.get(l.user_id) ?? { total: 0, active: 0, draft: 0 }
      agg.total += 1
      if (l.status === 'active') agg.active += 1
      if (l.status === 'draft') agg.draft += 1
      listingMap.set(l.user_id, agg)
    }

    const salesMap = new Map<string, { count: number; gmv: number }>()
    for (const o of orders) {
      if (!o.seller_id) continue
      if (o.status !== 'confirmed' || o.is_admin_test === true) continue
      const agg = salesMap.get(o.seller_id) ?? { count: 0, gmv: 0 }
      agg.count += 1
      agg.gmv += num(o.amount)
      salesMap.set(o.seller_id, agg)
    }

    for (const tip of tippedGms) {
      const agg = salesMap.get(tip.sellerUserId) ?? { count: 0, gmv: 0 }
      agg.count += 1
      agg.gmv += tip.listingPriceUsd
      salesMap.set(tip.sellerUserId, agg)
    }

    const users: AdminUserDirectoryRow[] = profiles.map((p) => {
      const listingAgg = listingMap.get(p.id)
      const salesAgg = salesMap.get(p.id)
      return {
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        city: p.city,
        is_admin: p.is_admin === true,
        is_employee: p.is_employee === true,
        shop_verified: p.shop_verified === true,
        is_reswell_seller: p.is_reswell_seller === true,
        created_at: p.created_at,
        listings_count: listingAgg?.total ?? 0,
        active_listings_count: listingAgg?.active ?? 0,
        draft_listings_count: listingAgg?.draft ?? 0,
        sales_count: salesAgg?.count ?? 0,
        gmv: salesAgg?.gmv ?? 0,
      }
    })

    return { ok: true, data: { users, generatedAt: new Date().toISOString() } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adminUsersDirectory] load failed:', message)
    return { ok: false, error: `Could not load the user directory: ${message}` }
  }
}
