import { applyCanonicalSurfboardCategoryToListingRow } from "@/lib/surfboard-category-display"
import {
  fetchAdminListingsStats,
  listAdminListingsPage,
  type AdminListingsStats,
} from "@/lib/db/adminListings"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { AdminListingsListQuery } from "@/lib/validations/admin-listings-list"

export type AdminListingsListPayload = {
  listings: Record<string, unknown>[]
  total: number
  stats: AdminListingsStats
}

export async function getAdminListingsList(
  query: AdminListingsListQuery,
): Promise<{ ok: true; data: AdminListingsListPayload } | { ok: false; error: string }> {
  let db: ReturnType<typeof createServiceRoleClient>
  try {
    db = createServiceRoleClient()
  } catch (e) {
    console.error("[admin listings list] service role:", e)
    return { ok: false, error: "Server misconfigured" }
  }

  const [page, stats] = await Promise.all([
    listAdminListingsPage(db, query),
    fetchAdminListingsStats(db),
  ])

  if (page.error) {
    return { ok: false, error: page.error }
  }

  return {
    ok: true,
    data: {
      listings: page.rows.map((row) => applyCanonicalSurfboardCategoryToListingRow(row)),
      total: page.total,
      stats,
    },
  }
}
