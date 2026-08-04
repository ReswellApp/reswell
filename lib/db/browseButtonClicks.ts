import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrowseButtonClickInput } from "@/lib/validations/browse-button-click"

export interface BrowseButtonClickRow extends BrowseButtonClickInput {
  userId: string | null
}

/**
 * Persists one browse button click. Throws on failure; callers decide whether
 * logging failures are fatal (they never should be for user-facing flows).
 */
export async function insertBrowseButtonClick(
  supabase: SupabaseClient,
  row: BrowseButtonClickRow,
): Promise<void> {
  const { error } = await supabase.from("browse_button_clicks").insert({
    user_id: row.userId,
    category: row.category,
    button: row.button,
    detail: row.detail ?? null,
    facet_key: row.facetKey ?? null,
    facet_value: row.facetValue ?? null,
  })
  if (error) {
    throw new Error(error.message)
  }
}
