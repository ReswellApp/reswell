import {
  fetchAdminOverviewSnapshot,
  type AdminOverviewSnapshot,
} from '@/lib/db/adminOverview'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Platform-wide admin home snapshot (listings, members, orders, support).
 * Uses the service-role client — session RLS on `orders` only exposes buyer/seller rows.
 */
export async function loadAdminOverviewSnapshot(options: {
  includeBrandRequestQueries: boolean
}): Promise<AdminOverviewSnapshot> {
  const db = createServiceRoleClient()
  return fetchAdminOverviewSnapshot(db, options)
}
