import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SiteTrafficDashboardRow,
  SiteTrafficMonthRow,
  SiteTrafficWindowStats,
} from '@/lib/types/siteTraffic'
import { createServiceRoleClient } from '@/lib/supabase/server'

/** Persists client-reported page navigation (paired with Klaviyo page-view). */
export async function insertSiteTrafficPageView(
  supabase: Pick<SupabaseClient, 'from'>,
  input: { visitorKey: string; pathname: string },
): Promise<{ ok: boolean; error?: string }> {
  const { visitorKey, pathname } = input
  const at = pathname.trim()
  const vk = visitorKey.trim()
  if (at.length === 0 || vk.length === 0) return { ok: false, error: 'invalid input' }

  const { error } = await supabase.from('site_traffic_page_views').insert({
    visitor_key: vk,
    pathname: at,
  })
  if (error) return { ok: false, error: error.message }

  return { ok: true }
}

export async function fetchAdminSiteTrafficDashboard(
  months: number,
): Promise<{ ok: true; data: SiteTrafficDashboardRow } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase.rpc('admin_site_traffic_dashboard', {
      p_months: months,
    })
    if (error) return { ok: false, error: error.message }

    const parsed = parseDashboardJson(data as unknown)
    if (!parsed) return { ok: false, error: 'Invalid dashboard payload' }

    return { ok: true, data: parsed }
  } catch {
    return { ok: false, error: 'Failed to load traffic data' }
  }
}

function parseDashboardJson(raw: unknown): SiteTrafficDashboardRow | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const l7 = o.last7Days
  const l30 = o.last30Days
  const months = o.byMonth

  const win = (
    node: unknown,
  ): SiteTrafficWindowStats | null => {
    if (!node || typeof node !== 'object') return null
    const w = node as Record<string, unknown>
    const pageViews =
      typeof w.pageViews === 'number' ? w.pageViews : Number(w.pageViews)
    const uniqueVisitors =
      typeof w.uniqueVisitors === 'number'
        ? w.uniqueVisitors
        : Number(w.uniqueVisitors)
    if (
      Number.isFinite(pageViews) &&
      Number.isFinite(uniqueVisitors) &&
      uniqueVisitors >= 0 &&
      pageViews >= 0
    ) {
      return {
        pageViews: Math.trunc(pageViews),
        uniqueVisitors: Math.trunc(uniqueVisitors),
      }
    }
    return null
  }

  const w7 = win(l7)
  const w30 = win(l30)
  if (!w7 || !w30 || !Array.isArray(months)) return null

  const byMonth: SiteTrafficMonthRow[] = []
  for (const row of months) {
    if (!row || typeof row !== 'object') return null
    const r = row as Record<string, unknown>
    const monthStart =
      typeof r.monthStart === 'string' ? r.monthStart.trim() : ''
    const monthLabel =
      typeof r.monthLabel === 'string' ? r.monthLabel.trim() : ''
    const pageViews =
      typeof r.pageViews === 'number' ? r.pageViews : Number(r.pageViews)
    const uniqueVisitors =
      typeof r.uniqueVisitors === 'number'
        ? r.uniqueVisitors
        : Number(r.uniqueVisitors)
    if (
      monthStart &&
      Number.isFinite(pageViews) &&
      Number.isFinite(uniqueVisitors)
    ) {
      byMonth.push({
        monthStart,
        monthLabel: monthLabel || monthStart,
        pageViews: Math.trunc(pageViews),
        uniqueVisitors: Math.trunc(uniqueVisitors),
      })
      continue
    }
    return null
  }

  return { last7Days: w7, last30Days: w30, byMonth }
}
