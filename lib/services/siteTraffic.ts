import type { SiteTrafficDashboardRow } from '@/lib/types/siteTraffic'
import {
  fetchAdminSiteTrafficDashboard,
  insertSiteTrafficPageView,
} from '@/lib/db/siteTraffic'
import { createServiceRoleClient } from '@/lib/supabase/server'

function visitorKeyFromSession(input: {
  anonymousId?: string | null
  loggedInUserId?: string | null
}): string | null {
  const uid = typeof input.loggedInUserId === 'string' ? input.loggedInUserId.trim() : ''
  if (uid) return `user:${uid}`
  const anon = typeof input.anonymousId === 'string' ? input.anonymousId.trim() : ''
  if (anon) return `anon:${anon}`
  return null
}

/**
 * Saves a SPA page-view row when service role key is configured.
 * Caller supplies session user id (if any); does not persist email.
 */
export async function recordSiteTrafficPageViewEvent(input: {
  pathname: string
  anonymousId?: string | null
  loggedInUserId?: string | null
}): Promise<void> {
  const path = typeof input.pathname === 'string' ? input.pathname.trim() : ''
  if (!path) return

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return

  const vk = visitorKeyFromSession({
    anonymousId: input.anonymousId,
    loggedInUserId: input.loggedInUserId ?? null,
  })

  if (!vk) return

  try {
    const supabase = createServiceRoleClient()
    const inserted = await insertSiteTrafficPageView(supabase, {
      visitorKey: vk,
      pathname: path,
    })
    if (!inserted.ok && inserted.error) {
      console.error('[site-traffic] insert:', inserted.error)
    }
  } catch {
    console.error('[site-traffic] insert failed')
  }
}

export async function getSiteTrafficDashboardForAdmin(
  monthsBack: number,
): Promise<{ ok: true; data: SiteTrafficDashboardRow } | { ok: false; error: string }> {
  return fetchAdminSiteTrafficDashboard(monthsBack)
}
