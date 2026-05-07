import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchHomeRecentlySoldSurfboardRows } from "@/lib/db/home-recently-sold-strip"

export async function loadHomeRecentlySoldSurfboardRows(supabase: SupabaseClient): Promise<unknown[]> {
  return fetchHomeRecentlySoldSurfboardRows(supabase)
}
