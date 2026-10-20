import { fetchAdminCohortsDashboard } from "@/lib/db/adminCohorts"
import type { AdminCohortsDashboard } from "@/lib/types/adminCohorts"
import type { AdminCohortsQuery } from "@/lib/validations/adminCohorts"

export async function getAdminCohortsDashboard(
  query: AdminCohortsQuery,
): Promise<{ ok: true; data: AdminCohortsDashboard } | { ok: false; error: string }> {
  return fetchAdminCohortsDashboard({
    cohortMonths: query.cohortMonths,
    horizonMonths: query.horizonMonths,
  })
}
