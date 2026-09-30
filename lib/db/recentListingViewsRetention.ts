import type { SupabaseClient } from "@supabase/supabase-js"

export interface TrimRecentListingViewsBatchOptions {
  keepRows: number
  deleteLimit: number
}

export async function trimRecentListingViewsBatch(
  supabase: SupabaseClient,
  options: TrimRecentListingViewsBatchOptions,
): Promise<number> {
  const { data, error } = await supabase.rpc("trim_user_recently_viewed_listings", {
    p_keep_rows: options.keepRows,
    p_delete_limit: options.deleteLimit,
  })

  if (error) {
    throw new Error(`Recently viewed retention failed: ${error.message}`)
  }

  const deleted = Number(data)
  if (!Number.isInteger(deleted) || deleted < 0 || deleted > options.deleteLimit) {
    throw new Error("Recently viewed retention returned an invalid delete count")
  }

  return deleted
}
