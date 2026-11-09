import { parseAdminCohortsDashboard } from "@/lib/db/adminCohortsParse"
import { getDb } from "@/lib/supabase/db"
import type { AdminCohortsDashboard } from "@/lib/types/adminCohorts"

export async function fetchAdminCohortsDashboard(input: {
  cohortMonths: number
  horizonMonths: number
}): Promise<{ ok: true; data: AdminCohortsDashboard } | { ok: false; error: string }> {
  try {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    const { data, error } = await supabase.rpc("admin_user_cohorts_dashboard", {
      p_cohort_months: input.cohortMonths,
      p_horizon_months: input.horizonMonths,
    })
    if (error) return { ok: false, error: error.message }

    const parsed = parseAdminCohortsDashboard(data)
    if (!parsed) return { ok: false, error: "Invalid cohort dashboard payload" }

    return { ok: true, data: parsed }
  } catch {
    return { ok: false, error: "Failed to load cohort analytics" }
  }
}
