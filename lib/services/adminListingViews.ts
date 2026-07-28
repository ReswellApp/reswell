import { fetchAdminListingViewsDashboard } from "@/lib/db/adminListingViews"
import type { AdminListingViewsDashboard } from "@/lib/types/adminListingViews"
import type { AdminListingViewsQuery } from "@/lib/validations/adminListingViews"

export async function getAdminListingViewsDashboard(
  query: AdminListingViewsQuery,
): Promise<{ ok: true; data: AdminListingViewsDashboard } | { ok: false; error: string }> {
  return fetchAdminListingViewsDashboard(query)
}
