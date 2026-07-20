import type { SupabaseClient } from '@supabase/supabase-js'

/** Badge counts keyed by admin nav href. */
export type AdminNavBadgeCounts = Record<string, number>

export async function fetchAdminNavBadgeCounts(
  supabase: SupabaseClient,
  options: { includeBrandRequests: boolean },
): Promise<AdminNavBadgeCounts> {
  const [supportNewRes, fraudRes, opsOpenRes, brandPendingRes, labelFailuresRes] =
    await Promise.all([
      supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('support_status', 'new'),
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
    ])

  const take = (res: { count: number | null; error: unknown }): number => {
    if (res.error) return 0
    return res.count ?? 0
  }

  const counts: AdminNavBadgeCounts = {
    '/admin/contact-messages': take(supportNewRes),
    '/admin/fraud-messages': take(fraudRes),
    '/admin/ops': take(opsOpenRes),
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

export function sumAdminNavBadgeCounts(
  counts: AdminNavBadgeCounts,
  hrefs: string[],
): number {
  return hrefs.reduce((sum, href) => sum + (counts[href] ?? 0), 0)
}
