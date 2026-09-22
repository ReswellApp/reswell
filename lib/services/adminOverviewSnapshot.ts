import {
  fetchAdminOverviewSnapshot,
  type AdminOverviewSnapshot,
} from '@/lib/db/adminOverview'
import { getDb } from '@/lib/supabase/db'

/**
 * Platform-wide admin home snapshot (listings, members, orders, support).
 * Uses the service-role client — session RLS on `orders` only exposes buyer/seller rows.
 */
export async function loadAdminOverviewSnapshot(options: {
  includeBrandRequestQueries: boolean
}): Promise<AdminOverviewSnapshot> {
  const db = getDb({ consistency: "eventual", purpose: "analytics" })
  return fetchAdminOverviewSnapshot(db, options)
}
