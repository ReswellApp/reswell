import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { countCheckoutBlockedHiddenActiveListings } from '@/lib/db/adminHiddenListings'
import type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'

export type { AdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'
export { sumAdminNavBadgeCounts } from '@/lib/admin-nav-badge-counts'

/** Hidden listing counts require service role (RLS hides rows from staff session). */
async function fetchHiddenActiveCheckoutBlockedCount(): Promise<number> {
  try {
    const service = createServiceRoleClient()
    return await countCheckoutBlockedHiddenActiveListings(service)
  } catch {
    return 0
  }
}

export async function fetchAdminNavBadgeCounts(
  supabase: SupabaseClient,
  options: { includeBrandRequests: boolean },
): Promise<AdminNavBadgeCounts> {
  const [supportNewRes, liveChatOpenRes, fraudRes, opsOpenRes, brandPendingRes, labelFailuresRes, hiddenActiveRes] =
    await Promise.all([
      supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('support_status', 'new'),
      supabase
        .from('live_chat_sessions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'assigned']),
      supabase.from('fraud_messages').select('*', { count: 'exact', head: true }),
      supabase
        .from('ops_groups')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      options.includeBrandRequests
        ? supabase
            .from('brand_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
        : Promise.resolve({ count: 0 as number | null, error: null }),
      options.includeBrandRequests
        ? supabase
            .from('order_shipping_label_failures')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open')
        : Promise.resolve({ count: 0 as number | null, error: null }),
      fetchHiddenActiveCheckoutBlockedCount(),
    ])

  const take = (res: { count: number | null; error: unknown }): number => {
    if (res.error) return 0
    return res.count ?? 0
  }

  const counts: AdminNavBadgeCounts = {
    '/admin/contact-messages': take(supportNewRes),
    '/admin/live-chat': take(liveChatOpenRes),
    '/admin/fraud-messages': take(fraudRes),
    '/admin/ops': take(opsOpenRes),
    '/admin/listings/hidden': hiddenActiveRes,
  }

  if (options.includeBrandRequests) {
    counts['/admin/listings/brand-requests'] = take(
      brandPendingRes as { count: number | null; error: unknown },
    )
    counts['/admin/shipping'] = take(
      labelFailuresRes as { count: number | null; error: unknown },
    )
  }

  return counts
}
