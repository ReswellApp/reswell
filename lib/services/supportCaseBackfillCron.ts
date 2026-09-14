import { createServiceRoleClient } from "@/lib/supabase/server"
import { backfillRecentLegacySupportCases } from "@/lib/services/supportCaseBackfill"

export async function backfillRecentLegacySupportCasesService() {
  const supabase = createServiceRoleClient()
  return backfillRecentLegacySupportCases(supabase, 400)
}
