import type { SupabaseClient } from "@supabase/supabase-js"

import { trimRecentListingViewsBatch } from "@/lib/db/recentListingViewsRetention"
import {
  runRecentListingViewsRetention,
  type RecentListingViewsRetentionSummary,
} from "@/lib/services/recentListingViewsRetentionPolicy"

export async function trimRecentListingViewsRetention(
  supabase: SupabaseClient,
): Promise<RecentListingViewsRetentionSummary> {
  return runRecentListingViewsRetention((options) =>
    trimRecentListingViewsBatch(supabase, options),
  )
}
